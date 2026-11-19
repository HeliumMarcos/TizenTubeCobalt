const test=require('node:test');
const assert=require('node:assert/strict');
const policy=require('../src/bitrate-policy.js');
const matrix=require('./fixtures/selected-42.json');
test('defaults are40/100 and explicit existing preferences survive unchanged',()=>{
 assert.deepEqual(policy.resolveConfig({}),{av1Mbps:40,otherMbps:100});
 const saved={maxAv1BitrateMbps:'20',maxOtherBitrateMbps:'150'};
 assert.deepEqual(policy.resolveConfig(saved),{av1Mbps:20,otherMbps:150});assert.equal(saved.maxAv1BitrateMbps,'20');
 assert.equal(policy.resolveConfig({maxAv1BitrateMbps:'unlimited'}).av1Mbps,Infinity);
});
test('only identified representative bitrate sources count; peak is diagnostic only',()=>{
 assert.deepEqual(policy.representativeBitrate({averageBitrate:27970000,bitrate:220000000}),{bps:27970000,source:'averageBitrate'});
 assert.deepEqual(policy.representativeBitrate({hlsAverageBandwidth:32000000,bitrate:220000000}),{bps:32000000,source:'HLS-AVERAGE-BANDWIDTH'});
 assert.deepEqual(policy.representativeBitrate({observedAverageBitrate:18000000,observedBitrateEvidence:{method:'segment-bytes',bytes:22500000,durationSeconds:10}}),{bps:18000000,source:'observed-average'});
 for(const f of [{bitrate:1000000},{averageBitrate:0,bitrate:1000000},{averageBitrate:NaN},{observedAverageBitrate:18000000},{referenceBitrateMbps:1}])assert.equal(policy.representativeBitrate(f),null);
});
test('inclusive caps use the representative rate without vetoing or rewriting the peak',()=>{
 const f={mimeType:'video/mp4; codecs="av01"',averageBitrate:40000000,bitrate:900000000};const before=JSON.stringify(f);
 assert.equal(policy.assess(f,{},true).state,'DISCOVERED');assert.equal(JSON.stringify(f),before);
 assert.equal(policy.assess({...f,averageBitrate:40000001},{},true).state,'BLOCKED_CAP');
 assert.equal(policy.assess({mimeType:'video/webm; codecs="vp9"',averageBitrate:100000000},{},true).state,'DISCOVERED');
 assert.equal(policy.assess({mimeType:'video/webm; codecs="vp9"',averageBitrate:100000001},{},true).state,'BLOCKED_CAP');
});
test('unknown rate, unknown capability and unsupported capability never claim READY',()=>{
 assert.equal(policy.assess({bitrate:1},{},true).state,'UNKNOWN');
 assert.equal(policy.assess({averageBitrate:1000000},{},null).state,'UNKNOWN');
 assert.equal(policy.assess({averageBitrate:1000000},{},false).state,'BLOCKED_CODEC');
 assert.equal(policy.assess({averageBitrate:1000000},{},true).state,'DISCOVERED');
});
test('all42 reference fixtures are tested as reference evidence, never as live routes',()=>{
 assert.equal(matrix.formats.length,42);const counts={},blocked=[];
 for(const f of matrix.formats){counts[f.codecFamily]=(counts[f.codecFamily]||0)+1;
  // Fixture adapter deliberately tags report data; production policy never reads referenceBitrateMbps.
  const meta={mimeType:f.codecFamily==='AV1'?'video/mp4; codecs="av01"':'video/webm; codecs="vp9"',averageBitrate:Math.round(f.referenceBitrateMbps*1e6)};
  const result=policy.assess(meta,{},true);assert.equal(result.state!=='BLOCKED_CAP',f.expectedEligibleByReferenceBitrate,f.videoId+':'+f.itag);
  assert.notEqual(result.state,'READY');if(result.state==='BLOCKED_CAP')blocked.push(f.videoId+':'+f.itag);
 }
 assert.deepEqual(counts,{VP9:25,AV1:12,'H.264':5});assert.deepEqual(blocked,['MNsbPClRgyg:628']);
});
test('highest available resolution precedes codec preference, HDR then AV1 within that resolution',()=>{
 const rows=[{id:'av11080',height:1080,fps:60,hdr:true,codec:'AV1',state:'READY'},{id:'vp92160',height:2160,fps:60,hdr:false,codec:'VP9',state:'READY'},{id:'av12160',height:2160,fps:60,hdr:true,codec:'AV1',state:'BLOCKED_CAP'}];
 assert.equal(policy.rankReady(rows)[0].id,'vp92160');
 assert.equal(policy.rankReady([...rows,{id:'av12160ok',height:2160,fps:60,hdr:true,codec:'AV1',state:'READY'}])[0].id,'av12160ok');
 assert.deepEqual(policy.rankReady(rows.filter(r=>r.state!=='READY')),[]);
});
test('visual quality hierarchy uses effectiveBitrate with VOD and Live codec multipliers',()=>{
 // Live 1080p60: AVC 6.5 Mbps (6.50) > VP9 3.48 Mbps (4.35)
 const liveVp9={height:1080,fps:60,mimeType:'video/webm; codecs="vp9"',bitrate:3480000};
 const liveAvc={height:1080,fps:60,mimeType:'video/mp4; codecs="avc1.64002a"',bitrate:6500000};
 assert.ok(policy.compareVisualQuality(liveAvc,liveVp9,{isLive:true,hdrSupported:true,preferHdr:true})<0);
 // VOD 4K60: AV1 15 Mbps (25.50) > VP9 18 Mbps (24.30)
 const vodAv1={height:2160,fps:60,mimeType:'video/mp4; codecs="av01.0.13M.10"',averageBitrate:15000000};
 const vodVp9={height:2160,fps:60,mimeType:'video/webm; codecs="vp09.02.51.10"',averageBitrate:18000000};
 assert.ok(policy.compareVisualQuality(vodAv1,vodVp9,{isLive:false,hdrSupported:true,preferHdr:true})<0);
 // HDR vs SDR never mix in bitrate comparison
 const hdrLow={height:2160,fps:30,mimeType:'video/webm; codecs="vp09.02.51.10"',averageBitrate:5000000,colorInfo:{transferCharacteristics:'COLOR_TRANSFER_CHARACTERISTICS_SMPTEST2084'}};
 const sdrHigh={height:2160,fps:30,mimeType:'video/webm; codecs="vp09.00.51.08"',averageBitrate:25000000};
 assert.ok(policy.compareVisualQuality(hdrLow,sdrHigh,{isLive:false,hdrSupported:true,preferHdr:true})<0);
 assert.ok(policy.compareVisualQuality(sdrHigh,hdrLow,{isLive:false,hdrSupported:false,preferHdr:true})<0);
});
