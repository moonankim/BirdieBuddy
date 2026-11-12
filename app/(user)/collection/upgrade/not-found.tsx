import Link from 'next/link';
export default function UpgradeCardNotFound(){
  return <section className="bb-status-screen">
    <h1 className="page-title">강화할 카드를 찾을 수 없어요</h1>
    <p>컬렉션에서 카드를 선택한 뒤 다시 시작해 주세요.</p>
    <Link className="bb-button" href="/collection">컬렉션으로</Link>
  </section>;
}
