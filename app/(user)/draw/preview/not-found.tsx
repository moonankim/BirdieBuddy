import Link from 'next/link';
export default function DrawPreviewNotFound(){
  return <section className="bb-status-screen">
    <h1 className="page-title">미리볼 카드를 찾을 수 없어요</h1>
    <p>등급은 basic·rare·legend 중 하나로 지정해 주세요.</p>
    <Link className="bb-button" href="/draw/preview">기본 미리보기로</Link>
  </section>;
}
