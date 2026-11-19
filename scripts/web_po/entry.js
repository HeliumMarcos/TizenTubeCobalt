import {BotGuardClient,getChallenge} from 'bgutils-js/botguard';
import {WebPoMinter} from 'bgutils-js/webpo';
import {buildURL,getHeaders} from 'bgutils-js/utils';
let scriptPolicy;const approvedScripts=new Set();
function runInterpreter(value){const script=document.createElement('script');const nonce=Array.from(document.scripts).find(s=>s.nonce)?.nonce;if(nonce)script.nonce=nonce;script.text=value;document.head.appendChild(script);script.remove();}
export async function createMinter(fetchFunction,requestKey='Z1elNkAKLpSR3oPOUMSN'){
 const challenge=await getChallenge({fetchFunction,requestKey,useYouTubeAPI:true});
 let js=challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
 if(!js){const url=challenge.interpreterUrl?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;if(!url)throw new Error('Missing interpreter');const r=await fetchFunction(url);if(!r.ok)throw new Error('Interpreter HTTP '+r.status);js=await r.text();}
 let script=js;
 if(globalThis.trustedTypes){
  if(!scriptPolicy)scriptPolicy=trustedTypes.createPolicy('tizentube-webpo',{createScript:value=>{if(!approvedScripts.has(value))throw new TypeError('Unapproved BotGuard interpreter');return value;}});
  approvedScripts.add(js);
  try{script=scriptPolicy.createScript(js);runInterpreter(script);}finally{approvedScripts.delete(js);}
 }else runInterpreter(script);
 const client=await BotGuardClient.create({program:challenge.program,globalName:challenge.globalName,globalObject:globalThis});
 const signals=[];
 try{
  const snapshot=await client.snapshot({webPoSignalOutput:signals},12000);
  const r=await fetchFunction(buildURL('GenerateIT',true),{method:'POST',headers:getHeaders(),body:JSON.stringify([requestKey,snapshot])});
  if(!r.ok)throw new Error('Integrity HTTP '+r.status);
  const [integrityToken,estimatedTtlSecs,mintRefreshThreshold,websafeFallbackToken]=await r.json();
  const minter=await WebPoMinter.create({integrityToken,estimatedTtlSecs,mintRefreshThreshold,websafeFallbackToken},signals);
  return {mint:binding=>minter.mintAsWebsafeString(binding),ttlMs:Math.max(60000,(Number(estimatedTtlSecs)||300)*1000),dispose:()=>client.shutdown(1000).catch(()=>{})};
 }catch(error){client.shutdown(1000).catch(()=>{});throw error;}
}


