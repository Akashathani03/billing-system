import { retrieveKnowledge } from '../../services/ai/knowledge.service.js';

describe('retrieveKnowledge', () => {
  test('1: the knowledge files load successfully and can answer a basic query', () => {
    const result = retrieveKnowledge('bill');
    expect(result.found).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  test('2: "How do I create a bill?" retrieves billing-related content', () => {
    const result = retrieveKnowledge('How do I create a bill?');

    expect(result.found).toBe(true);
    expect(result.chunks.some((c) => /generate bill|creating a bill|create a bill/i.test(c.text))).toBe(true);
  });

  test('3: "How do I add a customer?" retrieves customer-related content', () => {
    const result = retrieveKnowledge('How do I add a customer?');

    expect(result.found).toBe(true);
    expect(result.chunks.some((c) => /customer/i.test(c.heading) || /add customer/i.test(c.text))).toBe(true);
  });

  test('4: "How do I add a product?" retrieves product-related content', () => {
    const result = retrieveKnowledge('How do I add a product?');

    expect(result.found).toBe(true);
    expect(result.chunks.some((c) => c.source === 'product-guide.md' || /add product/i.test(c.text))).toBe(true);
  });

  test('5: a payment-related query retrieves payment documentation', () => {
    const result = retrieveKnowledge('What does pending payment mean?');

    expect(result.found).toBe(true);
    expect(result.chunks.some((c) => c.source === 'payment-guide.md')).toBe(true);
  });

  test('5b: "How do I mark a bill as paid?" also retrieves payment documentation', () => {
    const result = retrieveKnowledge('How do I mark a bill as paid?');

    expect(result.found).toBe(true);
    expect(result.chunks.some((c) => c.source === 'payment-guide.md')).toBe(true);
  });

  test('6: an irrelevant query returns no result rather than a weak guess', () => {
    const result = retrieveKnowledge('Tell me a joke about spaceships');

    expect(result.found).toBe(false);
    expect(result.chunks).toEqual([]);
  });

  test('6b: an empty or whitespace-only query returns no result', () => {
    expect(retrieveKnowledge('').found).toBe(false);
    expect(retrieveKnowledge('   ').found).toBe(false);
  });

  test('7: a path-like query cannot be used to read an arbitrary file — it is treated as ordinary text', () => {
    const attempts = ['../../.env', '/etc/passwd', '..\\..\\..\\backend\\.env', 'file:///etc/passwd'];

    for (const query of attempts) {
      const result = retrieveKnowledge(query);
      // Whatever the outcome, it must only ever be drawn from the known
      // knowledge chunks — never raw file content from an arbitrary path.
      for (const chunk of result.chunks) {
        expect(['billing-help.md', 'invoice-guide.md', 'payment-guide.md', 'product-guide.md', 'faq.md']).toContain(
          chunk.source,
        );
      }
    }
  });

  test('results never include secret-looking content', () => {
    const result = retrieveKnowledge('bill payment product customer');
    const allText = result.chunks.map((c) => c.text).join('\n');
    expect(allText).not.toMatch(/api[_-]?key|jwt|secret|password|mongodb:\/\//i);
  });
});
