/** Client-only display ordering. Underlying card indices never change. */
export function handTokens(cards) {
  const counts=new Map();
  return cards.map(card=>{
    if(card?.id!==undefined&&card.id!==null)return `id:${card.id}`;
    const signature=Object.keys(card??{}).sort().map(key=>`${key}:${JSON.stringify(card[key])}`).join('|');
    const n=counts.get(signature)||0;counts.set(signature,n+1);
    return `face:${signature}#${n}`;
  });
}
export function reconcileHandOrder(previous=[],cards=[]) {
  const tokens=handTokens(cards);
  const live=new Set(tokens);
  const retained=previous.filter((token,index)=>live.has(token)&&previous.indexOf(token)===index);
  const already=new Set(retained);
  return [...retained,...tokens.filter(token=>!already.has(token))];
}
export function moveHandToken(order,from,to) {
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=order.length||to>=order.length)return [...order];
  const result=[...order];result.splice(to,0,result.splice(from,1)[0]);return result;
}
export function sortHandOrder(cards,by='value') {
  const tokens=handTokens(cards);
  return tokens.map((token,index)=>({token,index,card:cards[index]})).sort((a,b)=>{
    const av=a.card?.value??0,bv=b.card?.value??0;
    const ac=String(a.card?.colour??a.card?.suit??''),bc=String(b.card?.colour??b.card?.suit??'');
    const difference=by==='colour'?ac.localeCompare(bc)||av-bv:av-bv||ac.localeCompare(bc);
    return difference||a.index-b.index;
  }).map(item=>item.token);
}
