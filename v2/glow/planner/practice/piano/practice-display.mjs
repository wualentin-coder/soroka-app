/** Assistance and notation are separate choices. Hidden recall stays hidden. */
export function selectedPracticeDisplay(policy,notation='falling'){
  if(!policy)return policy;
  if(policy.target===false&&policy.names===false&&policy.staff===false&&policy.falling===false)return {...policy};
  const mode=['falling','staff','both'].includes(notation)?notation:'falling';
  return {...policy,staff:mode!=='falling',falling:mode!=='staff'};
}
