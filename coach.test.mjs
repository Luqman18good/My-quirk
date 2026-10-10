import assert from "node:assert/strict";
import test from "node:test";
import handler from "../netlify/functions/coach.mjs";

const sampleInput = {
  current: {
    skillIndex: 0,
    skillName: "Wawancara UX",
    mission: "Susun panduan wawancara",
    technique: "Gunakan pertanyaan terbuka",
    stage: "base",
    challenge: "hard",
    evidence: "Saya baru mencoba satu pertanyaan."
  },
  skills: [{
    name: "Wawancara UX",
    value: 0,
    technique: "Gunakan pertanyaan terbuka",
    target: "Susun panduan wawancara",
    done: false
  }],
  recentHistory: []
};

test("validates input and returns a structured NVIDIA plan", async t => {
  const previousKey = process.env.NVIDIA_API_KEY;
  process.env.NVIDIA_API_KEY = "test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = previousKey;
  });

  const fetchMock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://integrate.api.nvidia.com/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    const request = JSON.parse(options.body);
    assert.equal(request.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
    assert.deepEqual(request.response_format, { type: "json_object" });
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        action: "retry",
        skillIndex: 0,
        mission: "Latihan lima menit",
        reason: "Mulai dengan langkah yang lebih kecil."
      }) } }]
    }), { status: 200 });
  });

  const response = await handler(new Request("http://localhost/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sampleInput)
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.action, "retry");
  assert.equal(result.skillIndex, 0);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("returns a useful error when the NVIDIA key is missing", async t => {
  const previousKey = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  t.after(() => {
    if (previousKey !== undefined) process.env.NVIDIA_API_KEY = previousKey;
  });

  const response = await handler(new Request("http://localhost/coach", { method: "POST" }));
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.match(result.error, /belum dikonfigurasi/);
});

test("rejects oversized request bodies before calling NVIDIA", async t => {
  process.env.NVIDIA_API_KEY = "test-key";
  t.after(() => delete process.env.NVIDIA_API_KEY);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("NVIDIA must not be called for an oversized request");
  });

  const response = await handler(new Request("http://localhost/coach", {
    method: "POST",
    body: " ".repeat(16001)
  }));

  assert.equal(response.status, 413);
  assert.equal(fetchMock.mock.callCount(), 0);
});