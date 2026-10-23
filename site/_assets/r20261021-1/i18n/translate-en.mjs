import dictionary from './en.dict.mjs';
import { memoizeTranslation } from './translation-cache.mjs';

const normalize=text=>text.trim().replace(/\s+/g,' ');
let root=null;
function translationTree(){
  if(root)return root;
  root=new Map();
  for(const [source,translation] of Object.entries(dictionary)){
    if(!source||source===translation)continue;
    let node=root;
    for(const char of source){if(!node.has(char))node.set(char,new Map());node=node.get(char)}
    node.translation=translation;
  }
  return root;
}
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const han=/\p{Script=Han}/u;
const hanGlobal=/\p{Script=Han}+/gu;
const englishOnly=value=>han.test(value)
  ? (value.replace(hanGlobal,' Translation unavailable ').replace(/\s+/g,' ').trim()||'Translation unavailable')
  : value;

function translateUncached(value){
  if(typeof value!=='string'||!value)return value;
  // HUD scores, timers and canvas measurements have no words to translate.
  if (/^[\d\s.,:+/%×−–—\-()|°∞]+$/u.test(value)) return value;
  const exact=dictionary[normalize(value)];
  if(exact!==undefined){const leading=value.match(/^\s*/)[0],trailing=value.match(/\s*$/)[0];return leading+englishOnly(exact)+trailing}
  value=value.replace(/(\d+(?:\.\d+)?)万/g,(_,n)=>Number(n)>=100?`${number.format(Number(n)/100)} million`:`${number.format(Number(n)*10)} thousand`)
    .replace(/第\s*(\d+)\s*名/g,(_,n)=>`Rank ${n}`);
  const tree=translationTree();let output='',i=0,changed=false;
  while(i<value.length){
    let node=tree,j=i,match=null,end=i;
    while(j<value.length&&node.has(value[j])){node=node.get(value[j++]);if(node.translation!==undefined){match=node.translation;end=j}}
    if(match!==null){
      if(/[\p{L}\p{N}]$/u.test(output)&&/^[\p{L}\p{N}]/u.test(match))output+=' ';
      output+=match;
      if(match&&/[\p{L}\p{N}]$/u.test(match)&&/^[\p{L}\p{N}]/u.test(value.slice(end)))output+=' ';
      i=end;changed=true;
    }else output+=value[i++];
  }
  return englishOnly(changed?output:value);
}

export const translateText = memoizeTranslation(translateUncached);

export function localizeMetadata(value){
  if(Array.isArray(value))return value.map(localizeMetadata);
  if(!value||typeof value!=='object')return value;
  const result={...value};
  if(typeof result.name==='string'){
    // The source client parses difficulty from this prefix before rendering.
    const prefix=result.name.match(/^(简单|普通|中等|困难)(?:\s*[-－—·]\s*|\s+)/);
    result.name=prefix?prefix[0]+translateText(result.name.slice(prefix[0].length)):translateText(result.name);
  }
  for(const field of ['description','title'])if(typeof result[field]==='string')result[field]=translateText(result[field]);
  return result;
}
