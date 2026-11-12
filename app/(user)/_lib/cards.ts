import type {CompleteRoundData,Grade,OwnedCardItem,Style} from '@/lib/api/types';

// 카드 화면 공통 표시 규칙. 데이터는 SDK(getCollection·getOwnedCards·completeRound)에서 온다.
export const gradeOrder:Grade[]=['common','rare','epic','special'];
export const gradeLabel:Record<Grade,string>={common:'일반',rare:'레어',epic:'에픽',special:'스페셜'};
export const styleLabel:Record<Style,string>={illust:'일러스트',retro:'레트로',holo:'홀로그램'};
export const gradeRank=(grade:Grade)=>gradeOrder.indexOf(grade);
export const byBestCard=(a:OwnedCardItem,b:OwnedCardItem)=>gradeRank(b.grade)-gradeRank(a.grade)||b.count-a.count;

// 홈 "라운드 완료" 결과를 발급 결과 화면(/draw)으로 넘긴다. 발급은 서버에서 이미 확정됐으므로 화면 이동·새로고침과 무관하다.
const LAST_DRAW_KEY='birdiebuddy-last-draw';
export function saveLastDraw(data:CompleteRoundData){try{sessionStorage.setItem(LAST_DRAW_KEY,JSON.stringify(data));}catch{}}
export function readLastDraw():CompleteRoundData|null{try{const raw=sessionStorage.getItem(LAST_DRAW_KEY);return raw?JSON.parse(raw) as CompleteRoundData:null;}catch{return null;}}
