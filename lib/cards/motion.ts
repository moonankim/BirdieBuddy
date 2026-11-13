// 카드 연출(강화·뽑기) 공통: 사용자가 동작 줄이기를 설정하면 연출 없이 결과로 간다.
export function prefersReducedMotion(){return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
