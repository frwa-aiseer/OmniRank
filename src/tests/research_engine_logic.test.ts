import { describe, it, expect, vi } from "vitest";
import { ResearchEngine } from "../server/research/engine.ts";
import { RESEARCH_MODE_CONFIGS } from "../types/research.ts";

const mockRepo = vi.hoisted(() => ({
  getProject: vi.fn(),
  listFindings: vi.fn(),
  listQuestions: vi.fn(),
  listSources: vi.fn(),
  saveBrief: vi.fn()
}));

vi.mock("../server/research/repository.ts", () => ({
  getResearchRepository: () => mockRepo
}));

describe("OR-P07-RUNTIME-GATE — Schema + Mode Logic", () => {
  const createMockClient = (errorMock?: any) => {
    const tableMocks: Record<string, any> = {};
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (!tableMocks[table]) {
          const selectMock = vi.fn().mockImplementation((columns) => {
            return {
              eq: vi.fn().mockImplementation((col, val) => {
                const res = { data: [], error: errorMock || null };
                return {
                  ...res,
                  maybeSingle: vi.fn().mockResolvedValue(res),
                  then: (cb: any) => Promise.resolve(res).then(cb)
                };
              })
            };
          });
          tableMocks[table] = { select: selectMock };
        }
        return tableMocks[table];
      })
    } as any;
  };

  it("brand_profiles and brand_audiences request exact columns", async () => {
    const client = createMockClient();
    const engine = new ResearchEngine(client);
    
    mockRepo.getProject.mockResolvedValue({ id: "p1", mode: "standard" });
    mockRepo.listFindings.mockResolvedValue([]);
    mockRepo.listQuestions.mockResolvedValue([]);
    mockRepo.listSources.mockResolvedValue([]);
    mockRepo.saveBrief.mockResolvedValue({ status: "draft" });

    await engine.prepareBrief("p1", "b1", "o1");

    expect(client.from).toHaveBeenCalledWith("brand_profiles");
    expect(client.from("brand_profiles").select).toHaveBeenCalledWith("mission, positioning_statement, target_market, value_proposition, tone_keywords");

    expect(client.from).toHaveBeenCalledWith("brand_audiences");
    expect(client.from("brand_audiences").select).toHaveBeenCalledWith("name, job_title, pain_points, goals, objections, preferred_channels, status");
  });

  it("DB context query returns an error -> fails closed", async () => {
    const client = createMockClient({ message: "Mocked DB Error" });
    const engine = new ResearchEngine(client);
    
    mockRepo.getProject.mockResolvedValue({ id: "p1", mode: "standard" });
    mockRepo.listFindings.mockResolvedValue([]);
    mockRepo.listQuestions.mockResolvedValue([]);
    mockRepo.listSources.mockResolvedValue([]);

    await expect(engine.prepareBrief("p1", "b1", "o1")).rejects.toThrow(/DB Error fetching context/);
  });

  it("FAST includes/excludes external/search_result sources", async () => {
    const client = createMockClient();
    const engine = new ResearchEngine(client);
    
    mockRepo.getProject.mockResolvedValue({ id: "p1", mode: "fast" });
    mockRepo.listFindings.mockResolvedValue([]);
    mockRepo.listQuestions.mockResolvedValue([]);
    mockRepo.listSources.mockResolvedValue([
      { id: "s1", classification: "brand" },
      { id: "s2", classification: "authoritative_external" },
      { id: "s3", classification: "search_result" }
    ]);

    await engine.prepareBrief("p1", "b1", "o1");

    const saveArgs = mockRepo.saveBrief.mock.calls[0][3];
    expect(saveArgs.sourceSelections).toContain("s1");
    expect(saveArgs.sourceSelections).not.toContain("s2");
    expect(saveArgs.sourceSelections).not.toContain("s3");
  });

  it("maxQuestions has behavioral effect", async () => {
    const client = createMockClient();
    const engine = new ResearchEngine(client);
    
    mockRepo.getProject.mockResolvedValue({ id: "p1", mode: "fast" });
    mockRepo.listFindings.mockResolvedValue([]);
    const manyQuestions = Array(10).fill(0).map((_, i) => ({ id: `q${i}`, questionText: `Question ${i}` }));
    mockRepo.listQuestions.mockResolvedValue(manyQuestions);
    mockRepo.listSources.mockResolvedValue([]);

    await engine.prepareBrief("p1", "b1", "o1");

    const saveArgs = mockRepo.saveBrief.mock.calls[0][3];
    const unanswered = saveArgs.unsupportedIssues.filter((i: string) => i.startsWith("Unanswered question"));
    expect(unanswered.length).toBe(RESEARCH_MODE_CONFIGS.fast.maxQuestions);
  });

  it("DEEP single-source support is surfaced", async () => {
    const client = createMockClient();
    const engine = new ResearchEngine(client);
    
    mockRepo.getProject.mockResolvedValue({ id: "p1", mode: "deep" });
    mockRepo.listQuestions.mockResolvedValue([]);
    mockRepo.listSources.mockResolvedValue([]);
    mockRepo.listFindings.mockResolvedValue([
      { id: "f1", supportStatus: "supported", findingText: "I am supported by 1 source", sourceReferences: ["s1"] }
    ]);

    await engine.prepareBrief("p1", "b1", "o1");

    const saveArgs = mockRepo.saveBrief.mock.calls[0][3];
    expect(saveArgs.unsupportedIssues).toContain("Insufficient multi-source support for finding: I am supported by 1 source");
  });
  it("knowledge, evidence, and articles request exact columns", async () => {
    const client = createMockClient();
    const engine = new ResearchEngine(client);
    mockRepo.getProject.mockResolvedValue({ id: "p1", mode: "standard" });
    mockRepo.listFindings.mockResolvedValue([]);
    mockRepo.listQuestions.mockResolvedValue([]);
    mockRepo.listSources.mockResolvedValue([]);
    await engine.prepareBrief("p1", "b1", "o1");
    expect(client.from).toHaveBeenCalledWith("knowledge_sources");
    expect(client.from("knowledge_sources").select).toHaveBeenCalledWith("id, name, type, source_url, trust_level, status");
    expect(client.from).toHaveBeenCalledWith("knowledge_documents");
    expect(client.from("knowledge_documents").select).toHaveBeenCalledWith("id, title, url, file_type, parsing_status, trust_level, classification");
    expect(client.from).toHaveBeenCalledWith("evidence_sources");
    expect(client.from("evidence_sources").select).toHaveBeenCalledWith("id, name, url, publisher, publication_date, trust_score, is_primary_source");
    expect(client.from).toHaveBeenCalledWith("evidence_claims");
    expect(client.from("evidence_claims").select).toHaveBeenCalledWith("id, claim_text, verification_status");
    expect(client.from).toHaveBeenCalledWith("articles");
    expect(client.from("articles").select).toHaveBeenCalledWith("id, title, status");
  });

});
