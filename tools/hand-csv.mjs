// Hand listings are real CSV: product names may contain commas or quotes.
export function parseCsv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"'&&cell==='')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('Unclosed quoted hand CSV field');
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  return rows;
}
export function formatCsvRow(row){return row.map(v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}).join(',');}
export function handRowKey(row){return JSON.stringify([...row.slice(0,5),row[6]||'']);}
export function mergeConfirmedHandRows(current,original,changes,dropped=new Set()) {
  const before=new Map(original.map(row=>[handRowKey(row),row]));
  return current.filter(row=>!dropped.has(handRowKey(row))).map(row=>{
    const key=handRowKey(row),base=before.get(key),change=changes.get(key);
    if(!base||!change)return row;
    if([5,8,9].some(i=>(row[i]||'')!==(base[i]||'')))return row;
    if(change[1]&&row[8]&&change[1]<row[8])return row;
    const next=[...row];while(next.length<10)next.push('');
    if(change[0]!=null){next[5]=change[0];next[8]=change[1];}
    if(change[3]==='true'||change[3]==='false')next[9]=change[3];
    if(change[2]&&!next[7].trim())next[7]=change[2];
    return next;
  });
}
