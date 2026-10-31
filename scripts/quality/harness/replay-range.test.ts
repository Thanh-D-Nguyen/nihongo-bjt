import { afterEach, expect, it } from "vitest";
import { CALC_GO, CALC_TEST_GO, addGoTest, makeFixture, type Fixture } from "./fixture";
import { fingerprint, worktreeBlobs } from "./lib/git.mjs";

let fx: Fixture;
afterEach(() => fx?.cleanup());

it("replays task production changed before the push base", () => {
  fx = makeFixture();
  expect(fx.run("begin", "FX-1", "Discount").code).toBe(0);
  expect(fx.run("spec", "--acceptance", "Discount is applied").code).toBe(0);
  expect(fx.run("classify", "DOMAIN_LOGIC", "--kind", "modify").code).toBe(0);
  fx.write("apps/api-go/internal/calc/calc_test.go", addGoTest(CALC_TEST_GO, `func TestDiscount(t *testing.T) { if got := Discount(200); got != 180 { t.Fatalf("discount: got %d want 180", got) } }`));
  expect(fx.run("red", "--go", "./internal/calc:TestDiscount", "--expect", "discount: got 200 want 180").code).toBe(0);
  fx.write("apps/api-go/internal/calc/calc.go", CALC_GO.replace("func Discount(total int) int { return total }", "func Discount(total int) int { return total * 9 / 10 }"));
  expect(fx.run("green").code).toBe(0);
  expect(fx.run("verify").code).toBe(0);
  expect(fx.run("close").code).toBe(0);
  const pushBase = fx.commit("implement discount");
  fx.git("checkout", "--detach", fx.base);
  fx.git("checkout", pushBase, "--", "apps/api-go/internal/calc/calc.go", "apps/api-go/internal/calc/calc_test.go", "tasks/FX-1.json");
  const task = fx.task("FX-1");
  task.title = "Clarified task title";
  fx.saveTask("FX-1", task);
  fx.commit("update task record");
  const replay = fx.run("replay", "--base", pushBase, "--head", "HEAD");
  expect(replay.code, replay.out).toBe(0);
  expect(replay.out).toContain("fail against base production code");
  expect(replay.out).toContain("pass on the final code");

  fx.write("apps/api-go/internal/calc/calc_test.go", addGoTest(CALC_TEST_GO, `func TestDiscount(t *testing.T) { if got := Discount(0); got != 0 { t.Fatalf("discount: got 200 want 180") } }`));
  const forged = fx.task("FX-1");
  forged.closed.files = worktreeBlobs(fx.dir, Object.keys(forged.closed.files));
  forged.closed.fingerprint = fingerprint(forged.closed.files);
  fx.saveTask("FX-1", forged);
  fx.commit("forge an insensitive red target");
  const forgedReplay = fx.run("replay", "--base", pushBase, "--head", "HEAD");
  expect(forgedReplay.code).toBe(1);
  expect(forgedReplay.out).toContain("test passes before the change");
}, 120_000);
