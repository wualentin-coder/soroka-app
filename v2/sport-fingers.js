/* Finger sizes are a separate address book, never body measurements or training data. */
function spFingerCount(profile) {
  const C = SP();
  return C.FINGER_HANDS.reduce((total, hand) => total + C.FINGER_NAMES.filter(finger =>
    C.fingerProfileValue(profile, "ringSizes", hand.id, finger.id) !== null).length, 0);
}
function spFingersCard() {
  const people = SP().fingerProfiles(spState().state).filter(person => spFingerCount(person));
  return `<button type="button" class="sp-metric" data-action="sp-fingers-open" aria-label="Пальцы: свои размеры и размеры других людей"><span>Пальцы</span><b>${people.length ? `${people.length} ${spPlural(people.length, "человек", "человека", "человек")}` : "Указать"}</b><small>Свои и других людей</small></button>`;
}
function spFingersList() {
  const people = SP().fingerProfiles(spState().state);
  return `<button class="text-action" type="button" data-action="sp-fingers-measures">${icon("left", "icon-sm")}Все замеры</button>
    <p class="section-note">Размеры для каждой руки. Добавляй свои и тех, кому выбираешь подарок.</p>
    <div class="spf-people">${people.map(person => `<div class="spf-person"><button class="spf-person-open" type="button" data-action="sp-finger-person" data-id="${spEsc(person.id)}"><span><b>${spEsc(person.name)}</b><small>${spFingerCount(person) ? `${spFingerCount(person)} из 10 пальцев` : "Размеры ещё не записаны"}</small></span>${icon("right", "icon-sm")}</button>${person.id !== "self" ? `<button class="icon-button spf-delete" type="button" data-action="sp-finger-delete" data-id="${spEsc(person.id)}" aria-label="Удалить размеры: ${spEsc(person.name)}">${icon("trash", "icon-sm")}</button>` : ""}</div>`).join("")}</div>
    <button class="ghost-button sp-wide" type="button" data-action="sp-finger-new">${icon("plus", "icon-sm")}Добавить человека</button>`;
}
function spFingerOpenPerson(id = crypto.randomUUID()) {
  const person = SP().fingerProfiles(spState().state).find(row => row.id === id)
    || { id, name: "", ringSizes: {}, updatedAt: "" };
  spOpen("finger-person", { id, person: JSON.parse(JSON.stringify(person)) });
}
function spFingerInput(value) { return value === null || value === undefined ? "" : String(value).replace(".", ","); }
SP_SHEETS.fingers = () => ({ title: "Пальцы", body: spFingersList() });
SP_SHEETS["finger-person"] = sheet => {
  const C = SP(), person = sheet.person;
  return { title: sheet.id === "self" ? "Мои пальцы" : person.name || "Новый человек", body: `
    <button class="text-action" type="button" data-action="sp-fingers-back">${icon("left", "icon-sm")}К списку людей</button>
    <form data-sp-form="finger-person" class="spf-form">
      <label class="field">Имя<input name="personName" maxlength="60" required value="${spEsc(person.name)}" placeholder="Как зовут человека" ${sheet.saving ? "disabled" : ""}></label>
      <fieldset class="spf-fields"><legend class="spf-caption">Размер кольца, например 16,5 или 17. Можно заполнить только нужные пальцы.</legend>
        <div class="spf-grid"><span></span>${C.FINGER_HANDS.map(hand => `<span class="spf-hand">${spEsc(hand.label)}</span>`).join("")}
        ${C.FINGER_NAMES.map(finger => `<span class="spf-finger">${spEsc(finger.label)}</span>${C.FINGER_HANDS.map(hand => `<input name="ringSizes-${hand.id}-${finger.id}" inputmode="decimal" maxlength="12" placeholder="—" value="${spFingerInput(C.fingerProfileValue(person, "ringSizes", hand.id, finger.id))}" aria-label="${spEsc(finger.label)}, ${spEsc(hand.label.toLocaleLowerCase())} рука, размер кольца" ${sheet.saving ? "disabled" : ""}>`).join("")}`).join("")}</div>
      </fieldset>
      <div class="sheet-actions"><button class="primary-button" type="submit" ${sheet.saving ? "disabled" : ""}>${sheet.saving ? "Сохраняю…" : "Сохранить"}</button></div>
    </form>` };
};
function spFingerBack() {
  if (confirmSheetDiscard(document.querySelector(".sp-sheet"))) spOpen("fingers");
}
SP_FORMS["finger-person"] = async form => {
  const s = spState(), sheet = s.sheet, C = SP();
  if (sheet?.kind !== "finger-person" || sheet.saving) return;
  const patch = {}, name = form.elements.personName.value.trim();
  if (name !== sheet.person.name || !s.state.fingerProfiles?.[sheet.id]) patch.name = name;
  for (const hand of C.FINGER_HANDS) for (const finger of C.FINGER_NAMES) {
    const key = `ringSizes-${hand.id}-${finger.id}`, value = form.elements.namedItem(key).value.trim();
    if (value && (!/^\d+(?:[.,]\d+)?$/.test(value) || Number(value.replace(",", ".")) <= 0 || Number(value.replace(",", ".")) > 1000)) {
      spSheetError(`${finger.label}, ${hand.label.toLocaleLowerCase()} рука: введи число больше нуля и не больше 1000.`);
      document.querySelector(`.spf-form [name="${key}"]`)?.focus();
      return;
    }
    const before = spFingerInput(C.fingerProfileValue(sheet.person, "ringSizes", hand.id, finger.id));
    if (value === before) continue;
    patch.ringSizes ||= {}; patch.ringSizes[hand.id] ||= {}; patch.ringSizes[hand.id][finger.id] = value;
  }
  let next;
  try { next = C.saveFingerProfile(s.state, sheet.id, patch, new Date().toISOString()); }
  catch (error) { spSheetError(error.message || "Проверь имя и размеры пальцев."); return; }
  sheet.saving = true; s.sheetError = "";
  // Enter can submit while the cursor stays in an input and suppresses Sport's
  // normal repaint. Lock this form before yielding so late edits cannot be lost.
  for (const control of form.elements) control.disabled = true;
  form.querySelector('[type="submit"]').textContent = "Сохраняю…";
  try {
    await spUpdate(prev => C.saveFingerProfile(prev, sheet.id, patch, next.fingerProfiles[sheet.id].updatedAt));
    if (s.sheet === sheet) spOpen("fingers");
    toast(s.demo ? "Размеры записаны в предпросмотре" : "Размеры сохранены");
  } catch (_) {
    if (s.sheet === sheet) { sheet.saving = false; spSheetError(s.saveError || "Не получилось сохранить. Данные остались в форме — попробуй ещё раз."); }
  }
};
SP_SHEETS["finger-delete"] = sheet => ({ title: "Удалить размеры?", body: `<p class="section-note">${spEsc(sheet.person.name)}: размеры обеих рук будут удалены.</p><div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp-fingers-back" ${sheet.saving ? "disabled" : ""}>Отмена</button><button class="primary-button" type="button" data-action="sp-finger-delete-confirm" ${sheet.saving ? "disabled" : ""}>${sheet.saving ? "Удаляю…" : "Удалить"}</button></div>` });
Object.assign(SP_ACTIONS, {
  "sp-fingers-open": () => spOpen("fingers"),
  "sp-fingers-measures": () => spOpen("section", { section: "body" }),
  "sp-fingers-back": spFingerBack,
  "sp-finger-new": () => spFingerOpenPerson(),
  "sp-finger-person": control => spFingerOpenPerson(control.dataset.id),
  "sp-finger-delete": control => {
    const person = SP().fingerProfiles(spState().state).find(row => row.id === control.dataset.id);
    if (person && person.id !== "self") spOpen("finger-delete", { id: person.id, person });
  },
  "sp-finger-delete-confirm": async () => {
    const s = spState(), sheet = s.sheet;
    if (sheet?.kind !== "finger-delete" || sheet.saving || sheet.id === "self") return;
    sheet.saving = true; s.sheetError = ""; render();
    try { await spUpdate(prev => SP().removeFingerProfile(prev, sheet.id)); if (s.sheet === sheet) spOpen("fingers"); }
    catch (_) { if (s.sheet === sheet) { sheet.saving = false; spSheetError(s.saveError || "Не получилось удалить. Попробуй ещё раз."); } }
  },
});
