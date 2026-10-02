sed -i '' -e '/vi.mock/,+2d' src/tests/research_engine_logic.test.ts
sed -i '' -e '4i\
vi.mock("../server/research/repository.ts", () => ({\
  getResearchRepository: () => mockRepo\
}));\
' src/tests/research_engine_logic.test.ts
