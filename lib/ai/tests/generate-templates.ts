import { writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";

const CATEGORIES = {
  profanity: { label: "욕설", scope: "선택", description: "욕설이나 비속어" },
  belittling: { label: "가벼운 비하", scope: "선택", description: "상대를 깎아내리거나 조롱하는 표현" },
  hate: { label: "혐오 표현", scope: "선택", description: "성별, 지역, 출신, 장애 등 집단에 대한 혐오" },
  appearance: { label: "외모 평가", scope: "선택", description: "상대의 외모나 몸매를 평가하는 표현" },
  threat: { label: "협박", scope: "항상 차단", description: "해를 끼치겠다는 위협" },
  stalking: { label: "스토킹성", scope: "항상 차단", description: "집요하게 따라다니거나 위치와 일상을 감시하는 내용" },
  sexual_harassment: { label: "성희롱", scope: "항상 차단", description: "성적인 언급이나 요구" },
  privacy: { label: "사생활 침해", scope: "항상 차단", description: "주소, 연락처, 가족 등 사적인 정보를 캐거나 공개하는 내용" },
  illegal_ad: { label: "불법 광고·도박", scope: "항상 차단", description: "불법 광고나 도박 홍보" },
  spam: { label: "스팸·도배", scope: "항상 차단", description: "같은 내용 반복이나 무의미한 도배" },
};

const TEMPLATE = {
  type: "object",
  additionalProperties: false,
  required: ["reason", "guide"],
  properties: { reason: { type: "string" }, guide: { anyOf: [{ type: "string" }, { type: "null" }] } },
};

const anthropic = new Anthropic();

const response = await anthropic.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 8000,
  system: "너는 스크린골프 인플루언서 팬 채팅방의 안내 문구를 쓴다.",
  messages: [
    {
      role: "user",
      content: [
        "메시지 전송 전 안전 필터가 위반을 찾았을 때 유저에게 보여 줄 한국어 문구를 항목별로 써 줘.",
        "",
        "항목:",
        ...Object.entries(CATEGORIES).map(([key, c]) => `- ${key} (${c.scope}): ${c.description}`),
        "",
        "reason: 왜 전송되지 않았는지 알려 주는 한 문장, 40자 이내.",
        'guide: scope가 "선택"인 항목만 어떻게 고쳐 쓰면 되는지 알려 주는 한 문장, 40자 이내. "항상 차단" 항목은 null.',
        "유저를 비난하지 않는 정중한 존댓말로 쓴다. 위반 표현을 예시로 옮겨 적지 않는다.",
      ].join("\n"),
    },
  ],
  output_config: {
    effort: "low",
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        additionalProperties: false,
        required: Object.keys(CATEGORIES),
        properties: Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, TEMPLATE])),
      },
    },
  },
});

if (response.stop_reason !== "end_turn") throw new Error(`stop_reason=${response.stop_reason}`);

let text = "";
for (const block of response.content) {
  if (block.type === "text") text += block.text;
}
await writeFile(new URL("./data/filter-templates.json", import.meta.url), JSON.stringify(JSON.parse(text), null, 2));
console.log(`input ${response.usage.input_tokens}, output ${response.usage.output_tokens}`);
