// 카드 UI의 최신 표시 계약. 기존 백엔드 enum에 임의로 매핑하지 않는다.
export type CardLevel = 'basic'|'rare'|'legend';
export type CardCategory = 'kpga'|'klpga'|'gtour'|'media';
export const cardLevelLabels:Record<CardLevel,string>={basic:'BASIC',rare:'RARE',legend:'LEGEND'};
export const cardCategoryLabels:Record<CardCategory,string>={kpga:'KPGA',klpga:'KLPGA',gtour:'G투어',media:'미디어'};
export const nextCardLevel:Record<CardLevel,CardLevel|null>={basic:'rare',rare:'legend',legend:null};

// UI 목업 비용. 실제 연결 시 getGameConfig의 upgrade_cost로 교체한다.
export const previewUpgradeCost=10;

export type CardPreview = {
  id:string;
  name:string;
  category:CardCategory;
  grade:CardLevel;
  count:number;
  verifiedAt:string|null;
};
