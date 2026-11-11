// 샌드박스 목업 카드 데이터. 현호P 실제 컬렉션 데이터로 교체한다.
export type Grade='일반'|'레어'|'에픽'|'스페셜';
export type MockCard={id:string;name:string;style:string;grade:Grade;count:number;art:''|'peach'|'lavender'};
export const gradeBadge:Record<Grade,string>={일반:'badge gray',레어:'badge',에픽:'badge epic',스페셜:'badge special'};
export const mockCards:MockCard[]=[
  {id:'c1',name:'인플루언서 1',style:'일러스트',grade:'레어',count:2,art:''},
  {id:'c2',name:'인플루언서 2',style:'레트로',grade:'일반',count:1,art:'peach'},
  {id:'c3',name:'인플루언서 3',style:'홀로그램',grade:'에픽',count:1,art:'lavender'},
];
export const TOTAL_TEMPLATES=30;
