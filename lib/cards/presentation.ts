// 카드 UI의 최신 표시 계약. 기존 백엔드 enum에 임의로 매핑하지 않는다.
export type CardLevel = 'basic'|'rare'|'legend';
export type CardCategory = 'kpga'|'klpga'|'gtour'|'media';
export const cardLevelLabels:Record<CardLevel,string>={basic:'BASIC',rare:'RARE',legend:'LEGEND'};
export const cardCategoryLabels:Record<CardCategory,string>={kpga:'KPGA',klpga:'KLPGA',gtour:'G투어',media:'미디어'};
export const nextCardLevel:Record<CardLevel,CardLevel|null>={basic:'rare',rare:'legend',legend:null};

// UI 목업 비용. 실제 연결 시 getGameConfig의 upgrade_cost로 교체한다.
export const previewUpgradeCost=10;

// 목업 공통 카드 이미지(R2 CDN). 선수·등급별 실제 아트가 아니며, SDK 연결 시 등급별 imageUrl로 교체한다.
export const previewCardImageUrl='https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/default-card-at.png';

// 기본 강화 연출 시간(시안). 높은 등급일수록 길게 보여 주며 서버 확정 이후에만 재생한다.
export const upgradeRevealMs:Record<Exclude<CardLevel,'basic'>,number>={rare:3000,legend:5000};

export type CardPreview = {
  id:string;
  name:string;
  category:CardCategory;
  grade:CardLevel;
  count:number;
  verifiedAt:string|null;
};
