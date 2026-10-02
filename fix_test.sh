sed -i '' -e '/it("Reviewer attempts review -> draft are denied", () => {/,+3d' src/tests/research_engine.test.ts
sed -i '' -e '/^});/i\
  it("Reviewer attempts review -> draft are denied", () => {\
    expect(sql).toContain("IF v_brief.status = '"'"'review'"'"' AND p_status = '"'"'draft'"'"' THEN");\
    expect(sql).toContain("RAISE EXCEPTION '"'"'Reviewer cannot move review to draft'"'"';");\
  });\
' src/tests/research_engine.test.ts
