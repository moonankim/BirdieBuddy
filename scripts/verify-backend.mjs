import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackendApi } from '../lib/api/index.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const credentialPath=path.join(root,'.demo-passwords.json');
const required=(name)=>{const value=process.env[name];if(!value)throw new Error(`Missing local environment value: ${name}. Run npm run local:env.`);return value;};
function assertLocalUrl(value,port,name){const url=new URL(value);if(!['localhost','127.0.0.1','::1'].includes(url.hostname)||url.port!==port)throw new Error(`${name} is not the expected local loopback endpoint.`);}
function check(condition,name){if(!condition)throw new Error(`FAIL ${name}`);console.log(`PASS ${name}`);}
function client(url,key){return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
async function signIn(supabase,account){const {data,error}=await supabase.auth.signInWithPassword({email:account.email,password:account.password});if(error||!data.user)throw new Error(`Local sign-in failed for ${account.email}.`);return data.user.id;}

async function main(){
  const url=required('BB_LOCAL_SUPABASE_URL');const publishableKey=required('BB_LOCAL_PUBLISHABLE_KEY');const secretKey=required('BB_LOCAL_SECRET_KEY');
  assertLocalUrl(url,'54321','Supabase URL');
  const credentials=JSON.parse(await readFile(credentialPath,'utf8')).accounts;
  const a=client(url,publishableKey);const b=client(url,publishableKey);const outsider=client(url,publishableKey);const owner=client(url,publishableKey);
  const admin=client(url,publishableKey);const pendingInfluencerClient=client(url,publishableKey);
  const service=client(url,secretKey);
  const [userA,userB,outside,influencer,adminUser,pendingInfluencer]=await Promise.all([
    signIn(a,credentials.userA),signIn(b,credentials.userB),signIn(outsider,credentials.outsider),signIn(owner,credentials.influencer),
    signIn(admin,credentials.admin),signIn(pendingInfluencerClient,credentials.pendingInfluencer),
  ]);
  const apiA=createBackendApi(a);const apiB=createBackendApi(b);const apiOutside=createBackendApi(outsider);const apiOwner=createBackendApi(owner);
  const apiAdmin=createBackendApi(admin);const apiPendingInfluencer=createBackendApi(pendingInfluencerClient);

  const ownProfile=await a.from('profiles').select('id,role').eq('id',userA);
  const otherProfile=await a.from('profiles').select('id').eq('id',userB);
  check(!ownProfile.error&&ownProfile.data?.length===1&&ownProfile.data[0].role==='user','user reads own profile and has user role');
  check(!otherProfile.error&&otherProfile.data?.length===0,'user cannot read another profile');

  const collection=await apiA.getCollection();
  check(collection.ok&&collection.data.items.length===30,'authenticated user reads seeded collection catalog');
  const rooms=await apiA.getRooms();
  check(rooms.ok&&rooms.data.items.length===10,'verified seeded rooms appear in room catalog');
  const firstRoom=rooms.ok?rooms.data.items.find((item)=>item.influencerId==='20000000-0000-4000-8000-000000000001'):undefined;
  if(!firstRoom)throw new Error('First demo room was not found.');

  const underqualifiedRoom=rooms.ok?rooms.data.items.find((item)=>item.influencerId==='20000000-0000-4000-8000-000000000002'):undefined;
  if(!underqualifiedRoom)throw new Error('Second demo room was not found.');
  const insufficientJoin=await apiB.joinRoom({requestId:'81000000-0000-4000-8000-000000000001',roomId:underqualifiedRoom.roomId});
  check(!insufficientJoin.ok&&insufficientJoin.error.code==='INSUFFICIENT_CARDS'&&insufficientJoin.error.details?.requiredCards===5&&insufficientJoin.error.details?.earnedCards===0,'room entry reports the exact card deficit');

  const firstTemplate=collection.ok?collection.data.items.find((item)=>item.template.influencerId===firstRoom.influencerId&&item.template.style==='illust'):undefined;
  if(!firstTemplate)throw new Error('First demo card template was not found.');
  const upgradeRequestIds=['81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000012'];
  const upgradeAttempts=await Promise.all(upgradeRequestIds.map((requestId)=>apiA.upgradeCard({requestId,templateId:firstTemplate.template.id,grade:'common'})));
  const winningUpgradeIndex=upgradeAttempts.findIndex((result)=>result.ok);
  const winningUpgrade=winningUpgradeIndex<0?undefined:upgradeAttempts[winningUpgradeIndex];
  const losingUpgrade=winningUpgradeIndex<0?undefined:upgradeAttempts[1-winningUpgradeIndex];
  check(Boolean(winningUpgrade?.ok&&winningUpgrade.data.consumed===10&&winningUpgrade.data.remainingCount===0&&winningUpgrade.data.toGrade==='rare'),'ten common cards upgrade atomically into one rare card');
  check(Boolean(losingUpgrade&&!losingUpgrade.ok&&losingUpgrade.error.code==='INSUFFICIENT_CARDS'&&losingUpgrade.error.details?.ownedCards===0),'concurrent second upgrade cannot consume a partial card balance');
  const upgradedRetry=winningUpgradeIndex<0?undefined:await apiA.upgradeCard({requestId:upgradeRequestIds[winningUpgradeIndex],templateId:firstTemplate.template.id,grade:'common'});
  check(Boolean(winningUpgrade?.ok&&upgradedRetry?.ok&&JSON.stringify(upgradedRetry.data)===JSON.stringify(winningUpgrade.data)),'same upgrade request replays without consuming cards twice');
  const underfundedUpgrade=await apiB.upgradeCard({requestId:'81000000-0000-4000-8000-000000000013',templateId:firstTemplate.template.id,grade:'common'});
  check(!underfundedUpgrade.ok&&underfundedUpgrade.error.code==='INSUFFICIENT_CARDS'&&underfundedUpgrade.error.details?.ownedCards===5,'upgrade rejects a balance below the ten-card cost');
  const maximumUpgrade=await apiA.upgradeCard({requestId:'81000000-0000-4000-8000-000000000003',templateId:firstTemplate.template.id,grade:'special'});
  check(!maximumUpgrade.ok&&maximumUpgrade.error.code==='MAX_GRADE','special card cannot be upgraded further');

  const initialBMessages=await apiB.getMessages({roomId:firstRoom.roomId});
  check(initialBMessages.ok&&initialBMessages.data.items.some((item)=>item.messageKind==='greeting'&&item.recipientUserId===userB)&&initialBMessages.data.items.every((item)=>item.messageKind!=='user_question'),'active member reads their greeting without another fan question');
  const outsiderMessages=await apiOutside.getMessages({roomId:firstRoom.roomId});
  check(!outsiderMessages.ok&&outsiderMessages.error.code==='ROOM_INACTIVE','non-member cannot read room messages');

  const ownVerification=await apiPendingInfluencer.getMyVerifications({limit:20});
  const pendingVerification=ownVerification.ok?ownVerification.data.items.find((item)=>item.status==='pending'):undefined;
  const adminPending=await apiAdmin.getPendingVerifications({limit:20});
  const userPending=await apiA.getPendingVerifications({limit:20});
  check(Boolean(pendingVerification&&adminPending.ok&&adminPending.data.items.some((item)=>item.id===pendingVerification.id)),'pending influencer sees their application and admin sees the review queue');
  check(Boolean(userPending.ok&&!userPending.data.items.some((item)=>item.id===pendingVerification?.id)),'ordinary user cannot inspect another influencer application');
  const duplicateVerification=await apiPendingInfluencer.requestVerification({requestId:'81000000-0000-4000-8000-000000000004',type:'tour',evidenceUrl:'https://example.test/evidence/duplicate'});
  check(!duplicateVerification.ok&&duplicateVerification.error.code==='PENDING_EXISTS','an influencer cannot open a second pending verification');
  const unauthorizedVerification=await apiA.requestVerification({requestId:'81000000-0000-4000-8000-000000000005',type:'tour',evidenceUrl:'https://example.test/evidence/unauthorized'});
  check(!unauthorizedVerification.ok&&unauthorizedVerification.error.code==='FORBIDDEN','ordinary user cannot create an influencer verification');
  const unauthorizedReview=await apiA.approveVerification({requestId:'81000000-0000-4000-8000-000000000006',verificationId:pendingVerification?.id??'00000000-0000-4000-8000-000000000000',decision:'rejected',reason:'권한 검증'});
  check(!unauthorizedReview.ok&&unauthorizedReview.error.code==='FORBIDDEN','ordinary user cannot review verification applications');

  const requestId='80000000-0000-4000-8000-000000000001';
  const joined=await apiA.joinRoom({requestId,roomId:firstRoom.roomId});
  check(joined.ok&&joined.data.membership.status==='active'&&joined.data.membership.gauge===50,'eligible user joins room with initial gauge');
  const joinedAgain=await apiA.joinRoom({requestId,roomId:firstRoom.roomId});
  check(joinedAgain.ok&&joined.ok&&JSON.stringify(joinedAgain.data)===JSON.stringify(joined.data),'same join request replays the first result');
  const messagesAfterJoin=await apiA.getMessages({roomId:firstRoom.roomId});
  check(messagesAfterJoin.ok&&messagesAfterJoin.data.items.some((item)=>item.messageKind==='greeting'&&item.recipientUserId===userA),'first verified-owner membership creates one greeting snapshot');
  const greetingMessage=messagesAfterJoin.ok?messagesAfterJoin.data.items.find((item)=>item.messageKind==='greeting'&&item.recipientUserId===userA):undefined;
  const greetingDelete=await apiOwner.deleteInfluencerMessage({requestId:'81000000-0000-4000-8000-000000000014',roomId:firstRoom.roomId,messageId:greetingMessage?.id??'0'});
  check(Boolean(greetingMessage&&!greetingDelete.ok&&greetingDelete.error.code==='NOT_FOUND'),'room owner cannot delete a fan greeting snapshot');

  const roomId=firstRoom.roomId;
  const questionBody='로컬 검증 질문입니다. 퍼팅 거리 조절은 어떻게 연습하면 좋을까요?';
  const questionRequestId='80000000-0000-4000-8000-000000000004';
  const questionPayload={roomId,body:questionBody};
  const questionHash=await service.rpc('internal_hash_payload',{p_payload:questionPayload});
  if(questionHash.error)throw new Error('Local service could not hash the question payload.');
  const questionBegin=await service.rpc('begin_message_submission',{p_actor_id:userA,p_room_id:roomId,p_request_id:questionRequestId,p_payload_hash:questionHash.data});
  if(questionBegin.error||!questionBegin.data)throw new Error('Local service could not reserve the question operation.');
  let questionResult=questionBegin.data.cachedResult;
  if(questionBegin.data.state==='processing'){
    const questionCommit=await service.rpc('submit_moderated_message',{
      p_actor_id:userA,p_room_id:roomId,p_request_id:questionRequestId,p_payload_hash:questionHash.data,
      p_lease_token:questionBegin.data.leaseToken,p_filter_version:questionBegin.data.filterVersion,p_body:questionBody,
      p_verdict:'pass',p_category:null,p_quality:72,p_passes_all_filters:true,p_rewrite:null,p_rewrite_quality:null,p_suggestion_token:null,
    });
    if(questionCommit.error)throw new Error('Local service could not commit the moderated question.');
    questionResult=questionCommit.data;
  }
  const question=questionResult?.message;
  check(question?.messageKind==='user_question'&&question.senderId===userA&&question.body===questionBody,'trusted moderation result creates one scored fan question');
  const questionRetry=await service.rpc('begin_message_submission',{p_actor_id:userA,p_room_id:roomId,p_request_id:questionRequestId,p_payload_hash:questionHash.data});
  check(!questionRetry.error&&questionRetry.data?.state==='succeeded'&&questionRetry.data.cachedResult?.message?.id===question?.id,'same message request replays the original question');

  const userAQuestionHistory=await apiA.getMessages({roomId});
  const userBQuestionHistory=await apiB.getMessages({roomId});
  check(userAQuestionHistory.ok&&userAQuestionHistory.data.items.some((item)=>item.id===question.id&&item.ownScore!==null&&item.qualityScore===72),'sender reads their persisted question and score snapshot');
  check(userBQuestionHistory.ok&&!userBQuestionHistory.data.items.some((item)=>item.id===question.id||item.messageKind==='user_question'),'another active member cannot read the fan question');

  const unauthenticatedEdge=await fetch(`${url}/functions/v1/submit-message`,{
    method:'POST',headers:{apikey:publishableKey,'content-type':'application/json'},
    body:JSON.stringify({requestId:'80000000-0000-4000-8000-000000000007',roomId,body:'안전한 질문입니다.'}),
  });
  check(unauthenticatedEdge.status===401,'Edge gateway rejects a request without a user JWT');
  const {data:{session:userSession}}=await a.auth.getSession();
  if(!userSession?.access_token)throw new Error('Local user session disappeared before Edge verification.');
  const directEdge=await fetch(`${url}/functions/v1/submit-message`,{
    method:'POST',headers:{apikey:publishableKey,authorization:`Bearer ${userSession.access_token}`,'content-type':'application/json'},
    body:JSON.stringify({requestId:'83000000-0000-4000-8000-000000000001',roomId,body:'안전한 질문입니다.'}),
  });
  const directEdgeBody=await directEdge.json().catch(()=>({}));
  check(directEdge.status===200&&directEdgeBody?.ok===true&&directEdgeBody?.data?.verdict==='pass','local AI fixture accepts an authenticated Edge request');
  const fixturePassBody='로컬 AI fixture 일반 통과 질문입니다.';
  const fixturePass=await apiA.submitMessage({requestId:'83000000-0000-4000-8000-000000000002',roomId,body:fixturePassBody});
  check(fixturePass.ok&&fixturePass.data.verdict==='pass'&&fixturePass.data.message.qualityScore===50&&!fixturePass.data.passesAllFilters,'local AI fixture produces a clearly non-live quality-50 pass');

  const suggestionBody='[[fixture:suggest]] 표현을 부드럽게 바꾸는 질문입니다.';
  const suggestion=await apiA.submitMessage({requestId:randomUUID(),roomId,body:suggestionBody});
  check(suggestion.ok&&suggestion.data.verdict==='suggest'&&Boolean(suggestion.data.suggestionToken)&&Boolean(suggestion.data.rewrite),'local AI fixture returns a one-time suggestion sample');
  let acceptedSuggestion;
  if(suggestion.ok&&suggestion.data.verdict==='suggest'&&suggestion.data.suggestionToken&&suggestion.data.rewrite){
    acceptedSuggestion=await apiA.submitMessage({requestId:'83000000-0000-4000-8000-000000000004',roomId,body:suggestion.data.rewrite,suggestionToken:suggestion.data.suggestionToken});
  }
  check(Boolean(acceptedSuggestion?.ok&&acceptedSuggestion.data.verdict==='pass'),'local suggestion token accepts the exact rewritten body');
  const blockedBody='[[fixture:block]] 위협 차단 fixture 질문입니다.';
  const blockedMessage=await apiA.submitMessage({requestId:'83000000-0000-4000-8000-000000000005',roomId,body:blockedBody});
  const historyAfterModeration=await apiA.getMessages({roomId});
  check(blockedMessage.ok&&blockedMessage.data.verdict==='block'&&blockedMessage.data.message===null,'local AI fixture returns the mandatory block sample');
  check(historyAfterModeration.ok&&!historyAfterModeration.data.items.some((item)=>item.body===suggestionBody||item.body===blockedBody),'suggestion source and blocked text are not persisted');

  const checkpoint=await apiA.getRoomMessageCheckpoint({roomId});
  const changes=checkpoint.ok?await apiA.getMessageChanges({roomId,checkpoint:null,through:checkpoint.data,limit:100}):null;
  check(Boolean(changes?.ok&&changes.data.items.some((item)=>item.id===question.id)),'message change cursor returns the question through a fixed checkpoint');
  const invalidCursor=checkpoint.ok&&checkpoint.data?await apiA.getMessageChanges({roomId,checkpoint:{updatedAt:checkpoint.data.updatedAt,id:'not-a-bigint'},through:checkpoint.data}):null;
  check(Boolean(invalidCursor&&!invalidCursor.ok&&invalidCursor.error.code==='VALIDATION_ERROR'),'message recovery rejects malformed decimal cursors');

  const influencerInbox=await apiOwner.getRoomInbox({roomId});
  const questionInboxItem=influencerInbox.ok?influencerInbox.data.items.find((item)=>item.kind==='question'&&item.question.id===question.id):undefined;
  check(Boolean(questionInboxItem&&questionInboxItem.priority===question.priority&&questionInboxItem.replyTo===question.id),'verified room owner inbox sorts and identifies the pending question');

  const answerBody='퍼팅 거리감은 짧은 스트로크와 긴 스트로크를 나눠 반복하며 리듬을 일정하게 맞춰 보세요.';
  const answerRequestId='80000000-0000-4000-8000-000000000005';
  const answerPayload={roomId,kind:'answer',replyTo:question.id,expectedClusterId:null,expectedClusterVersion:null,body:answerBody};
  const answerHash=await service.rpc('internal_hash_payload',{p_payload:answerPayload});
  if(answerHash.error)throw new Error('Local service could not hash the answer payload.');
  const answerBegin=await service.rpc('begin_influencer_message_submission',{p_actor_id:influencer,p_room_id:roomId,p_request_id:answerRequestId,p_kind:'answer',p_payload_hash:answerHash.data});
  if(answerBegin.error||!answerBegin.data)throw new Error('Local service could not reserve the influencer answer.');
  let answerResult=answerBegin.data.cachedResult;
  if(answerBegin.data.state==='processing'){
    const answerCommit=await service.rpc('submit_influencer_message',{
      p_actor_id:influencer,p_room_id:roomId,p_request_id:answerRequestId,p_kind:'answer',p_payload_hash:answerHash.data,
      p_lease_token:answerBegin.data.leaseToken,p_reply_to:question.id,p_expected_cluster_id:null,p_expected_cluster_version:null,
      p_body:answerBody,p_verdict:'pass',p_category:null,
    });
    if(answerCommit.error)throw new Error('Local service could not commit the influencer answer.');
    answerResult=answerCommit.data;
  }
  const answer=answerResult?.data;
  check(answer?.messageKind==='influencer_answer'&&answer.replyTo===question.id,'verified owner creates one linked influencer answer');
  const fanQuestionDelete=await apiA.deleteInfluencerMessage({requestId:'81000000-0000-4000-8000-000000000015',roomId,messageId:answer?.id??'0'});
  check(!fanQuestionDelete.ok&&fanQuestionDelete.error.code==='NOT_FOUND','fan cannot delete an influencer answer or their own question through the owner endpoint');
  const answerRetry=await service.rpc('begin_influencer_message_submission',{p_actor_id:influencer,p_room_id:roomId,p_request_id:answerRequestId,p_kind:'answer',p_payload_hash:answerHash.data});
  check(!answerRetry.error&&answerRetry.data?.state==='succeeded'&&answerRetry.data.cachedResult?.data?.id===answer?.id,'same influencer answer request replays the original answer');

  const ownerHistoryBeforeDelete=await apiOwner.getMessages({roomId});
  const answerBeforeDelete=ownerHistoryBeforeDelete.ok?ownerHistoryBeforeDelete.data.items.find((item)=>item.id===answer.id):undefined;
  if(!answerBeforeDelete)throw new Error('Persisted influencer answer was not found in the owner history.');
  const answerAlreadyDeleted=answerBeforeDelete.deletedAt!==null;
  const ownerAnsweredInbox=await apiOwner.getRoomInbox({roomId,includeAnswered:true});
  const answeredItem=ownerAnsweredInbox.ok?ownerAnsweredInbox.data.items.find((item)=>item.kind==='question'&&item.question.id===question.id):undefined;
  check(Boolean(answeredItem&&(answerAlreadyDeleted?!answeredItem.answered:answeredItem.answered&&answeredItem.replyId===answer.id)),'inbox answer state matches the persisted soft-delete state');
  const answerHistoryA=await apiA.getMessages({roomId});
  const answerHistoryB=await apiB.getMessages({roomId});
  check(answerHistoryA.ok&&answerHistoryA.data.items.some((item)=>item.id===answer.id&&item.isReplyToMe),'question author sees their answer link');
  check(answerHistoryB.ok&&answerHistoryB.data.items.some((item)=>item.id===answer.id&&!item.isReplyToMe),'other active member sees the answer without private reply ownership');

  const deletedAnswer=await apiOwner.deleteInfluencerMessage({requestId:'80000000-0000-4000-8000-000000000006',roomId,messageId:answer.id});
  check(deletedAnswer.ok&&deletedAnswer.data.message.body===null&&deletedAnswer.data.message.deletedAt!==null,'verified owner soft-deletes answer text with idempotent retry');
  const pendingAfterDelete=await apiOwner.getRoomInbox({roomId});
  check(pendingAfterDelete.ok&&pendingAfterDelete.data.items.some((item)=>item.kind==='question'&&item.question.id===question.id&&!item.answered),'deleted answer reopens the original pending question');

  const clusterKey='localdemo';
  const clusterFirst=await apiA.submitMessage({requestId:'83000000-0000-4000-8000-000000000006',roomId,body:`[[fixture:cluster=${clusterKey}]] 퍼팅 거리 질문 하나입니다.`});
  const clusterSecond=await apiA.submitMessage({requestId:'83000000-0000-4000-8000-000000000007',roomId,body:`[[fixture:cluster=${clusterKey}]] 퍼팅 거리 질문 둘입니다.`});
  const clusterResult=await apiOwner.clusterQuestions({requestId:'83000000-0000-4000-8000-000000000008',roomId});
  check(clusterFirst.ok&&clusterSecond.ok&&clusterResult.ok&&clusterResult.data.clusters.some((cluster)=>cluster.memberCount===2),'local AI fixture groups only explicitly marked sample questions');
  const summaryResult=await apiOwner.summarizeRoom({requestId:'83000000-0000-4000-8000-000000000009',roomId});
  check(summaryResult.ok&&summaryResult.data.summary.startsWith('로컬 fixture 요약:'),'local AI fixture returns a sample room summary');

  const privilegedRpc=await a.rpc('begin_message_submission',{p_actor_id:userA,p_room_id:firstRoom.roomId,p_request_id:'80000000-0000-4000-8000-000000000002',p_payload_hash:'0'.repeat(64)});
  check(Boolean(privilegedRpc.error),'authenticated client cannot execute service-only message reservation');

  const sampleRound=await apiA.completeRound({requestId:'80000000-0000-4000-8000-000000000003',forceGrade:null});
  check(sampleRound.ok&&sampleRound.data.grade==='common'&&sampleRound.data.entryUnlocked===false,'local issuer fixture awards a deterministic sample without claiming a probability result');

  const dailyCount=await apiOwner.getRoomDailyBlockCount({roomId:firstRoom.roomId});
  check(dailyCount.ok&&dailyCount.data.count===1,'verified owner sees only the aggregate local fixture block count');

  const filtersBefore=await apiOwner.getRoomFilters({roomId});
  const userFilters=await apiA.getRoomFilters({roomId});
  const userFilterWrite=await apiA.updateRoomFilters({requestId:'81000000-0000-4000-8000-000000000007',roomId,disabledFilters:['profanity'],expectedVersion:filtersBefore.ok?filtersBefore.data.version:1});
  check(filtersBefore.ok&&!userFilters.ok&&userFilters.error.code==='NOT_FOUND'&&!userFilterWrite.ok&&userFilterWrite.error.code==='NOT_FOUND','fan cannot inspect or change room-owner moderation settings');
  if(!filtersBefore.ok)throw new Error('Room filter settings were not available to their owner.');
  const versionRequestId=(version)=>`82000000-0000-4000-8000-${Number(version).toString(16).padStart(12,'0')}`;
  try{
    const changedFilters=await apiOwner.updateRoomFilters({requestId:versionRequestId(filtersBefore.data.version),roomId,disabledFilters:['profanity','profanity'],expectedVersion:filtersBefore.data.version});
    const changedFiltersRetry=await apiOwner.updateRoomFilters({requestId:versionRequestId(filtersBefore.data.version),roomId,disabledFilters:['profanity','profanity'],expectedVersion:filtersBefore.data.version});
    check(changedFilters.ok&&changedFilters.data.version===filtersBefore.data.version+1&&JSON.stringify(changedFilters.data.disabledFilters)===JSON.stringify(['profanity']),'owner filter update normalizes duplicates and advances its version once');
    check(changedFilters.ok&&changedFiltersRetry.ok&&JSON.stringify(changedFiltersRetry.data)===JSON.stringify(changedFilters.data),'same filter update request replays the original version');
    const staleFilters=await apiOwner.updateRoomFilters({requestId:versionRequestId(filtersBefore.data.version+100000),roomId,disabledFilters:[],expectedVersion:filtersBefore.data.version});
    check(!staleFilters.ok&&staleFilters.error.code==='FILTERS_CHANGED','stale moderation settings are rejected with a version conflict');
  }finally{
    const latestFilters=await apiOwner.getRoomFilters({roomId});
    if(latestFilters.ok&&(latestFilters.data.version!==filtersBefore.data.version||JSON.stringify(latestFilters.data.disabledFilters)!==JSON.stringify(filtersBefore.data.disabledFilters))){
      const restore=await apiOwner.updateRoomFilters({requestId:versionRequestId(latestFilters.data.version),roomId,disabledFilters:filtersBefore.data.disabledFilters,expectedVersion:latestFilters.data.version});
      if(!restore.ok)throw new Error('Could not restore the local room filter settings after verification.');
    }
  }

  const configBefore=await apiAdmin.getGameConfig();
  const originalGauge=configBefore.ok?configBefore.data.find((entry)=>entry.key==='gauge'):undefined;
  if(!originalGauge)throw new Error('Local gauge configuration was not found.');
  const userConfigWrite=await apiA.updateGameConfig({requestId:'81000000-0000-4000-8000-000000000008',key:'gauge',value:originalGauge.value,expectedVersion:originalGauge.version});
  check(!userConfigWrite.ok&&userConfigWrite.error.code==='FORBIDDEN','ordinary user cannot update game configuration');
  const invalidGauge=await apiAdmin.updateGameConfig({requestId:'81000000-0000-4000-8000-000000000009',key:'gauge',value:{start:101,max:100,monthly_min_rounds:3,per_round_delta:12.5},expectedVersion:originalGauge.version});
  const configAfter=await apiAdmin.getGameConfig();
  const gaugeAfter=configAfter.ok?configAfter.data.find((entry)=>entry.key==='gauge'):undefined;
  check(!invalidGauge.ok&&invalidGauge.error.code==='CONFIG_INVALID'&&gaugeAfter?.version===originalGauge.version&&JSON.stringify(gaugeAfter.value)===JSON.stringify(originalGauge.value),'invalid admin gauge settings are rejected without changing the stored config');

  const greetingBefore=await apiOwner.getRoomGreeting({roomId});
  const fixtureGreeting=greetingBefore.ok?await apiOwner.updateRoomGreeting({requestId:randomUUID(),roomId,expectedVersion:greetingBefore.data.version,text:'새 인사말 로컬 fixture 검증'}):undefined;
  const greetingAfter=await apiOwner.getRoomGreeting({roomId});
  let restoredGreeting;
  if(greetingBefore.ok&&greetingAfter.ok&&greetingAfter.data.version!==greetingBefore.data.version){
    restoredGreeting=await apiOwner.updateRoomGreeting({requestId:randomUUID(),roomId,expectedVersion:greetingAfter.data.version,text:greetingBefore.data.text});
  }
  check(Boolean(greetingBefore.ok&&fixtureGreeting?.ok&&greetingAfter.ok&&restoredGreeting?.ok&&restoredGreeting.data.text===greetingBefore.data.text),'local AI fixture enables greeting update and restores the original sample');
  const fixtureBroadcast=await apiOwner.sendBroadcast({requestId:randomUUID(),roomId,body:'전체 공지 로컬 fixture 검증'});
  const messagesAfterFixtureBroadcast=await apiOwner.getMessages({roomId});
  const fixtureBroadcastMessage=fixtureBroadcast.ok?fixtureBroadcast.data:undefined;
  check(Boolean(fixtureBroadcastMessage&&messagesAfterFixtureBroadcast.ok&&messagesAfterFixtureBroadcast.data.items.some((item)=>item.body==='전체 공지 로컬 fixture 검증')),'local AI fixture enables a sample owner broadcast');
  if(fixtureBroadcastMessage){
    const cleanupBroadcast=await apiOwner.deleteInfluencerMessage({requestId:randomUUID(),roomId,messageId:fixtureBroadcastMessage.id});
    check(cleanupBroadcast.ok,'local verification removes its temporary broadcast sample');
  }

  console.log('Local role, card, verification, settings, message, inbox, cursor, retry, and RPC checks completed. AI/Realtime/browser and remote verification remain separate. No remote project was contacted.');
}

main().catch((error)=>{console.error(error instanceof Error?error.message:'Local backend verification failed.');process.exitCode=1;});
