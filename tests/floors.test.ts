import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyHerdrProtocol,
  compareTriple,
  orcaVersionMeetsFloor,
  parseDottedVersion,
} from "../src/floors.ts";

describe("classifyHerdrProtocol", () => {
  it("rejects protocols below 18", () => {
    assert.equal(classifyHerdrProtocol(17), "unsupported");
  });

  it("accepts 18 and every protocol after it", () => {
    assert.equal(classifyHerdrProtocol(18), "supported");
    assert.equal(classifyHerdrProtocol(19), "supported");
    assert.equal(classifyHerdrProtocol(20), "supported");
    assert.equal(classifyHerdrProtocol(21), "supported");
  });
});

describe("orcaVersionMeetsFloor", () => {
  it("treats 1.4.170 as the floor", () => {
    assert.equal(orcaVersionMeetsFloor("1.4.170"), true);
    assert.equal(orcaVersionMeetsFloor("1.4.169"), false);
    assert.equal(orcaVersionMeetsFloor("1.4.195"), true);
  });

  it("ignores prerelease suffixes after the third number", () => {
    assert.equal(orcaVersionMeetsFloor("1.4.178-rc.2"), true);
  });
});

describe("parseDottedVersion", () => {
  it("returns a triple", () => {
    assert.deepEqual(parseDottedVersion("1.4.170"), [1, 4, 170]);
  });

  it("compares triples in order", () => {
    assert.equal(compareTriple([1, 4, 169], [1, 4, 170]), -1);
    assert.equal(compareTriple([1, 4, 170], [1, 4, 170]), 0);
    assert.equal(compareTriple([1, 5, 0], [1, 4, 170]), 1);
  });
});
