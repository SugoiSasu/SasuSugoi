import { describe, expect, it } from "vitest";
import { displayNameOf, handleOf, profileParamOf, secondaryHandleOf } from "./display-name";

describe("handleOf", () => {
  it("prefixes a nick with @", () => {
    expect(handleOf({ username: "ania_pizza" })).toBe("@ania_pizza");
  });

  it("never produces '@null' for an account without a nick", () => {
    expect(handleOf({ username: null })).toBeNull();
    expect(handleOf({ username: "" })).toBeNull();
    expect(handleOf({ username: "   " })).toBeNull();
    expect(handleOf(null)).toBeNull();
    expect(handleOf(undefined)).toBeNull();
  });
});

describe("displayNameOf", () => {
  it("prefers the display name", () => {
    expect(displayNameOf({ display_name: "Ania K.", username: "ania" })).toBe("Ania K.");
  });

  it("falls back to the handle", () => {
    expect(displayNameOf({ display_name: null, username: "ania" })).toBe("@ania");
    expect(displayNameOf({ display_name: "  ", username: "ania" })).toBe("@ania");
  });

  it("shows a named person by name even without a nick (not 'Anonim')", () => {
    expect(displayNameOf({ display_name: "Ania K.", username: null })).toBe("Ania K.");
  });

  it("uses the fallback when there is nothing to show", () => {
    expect(displayNameOf({ display_name: null, username: null })).toBe("Użytkownik");
    expect(displayNameOf(null, "Znajomy")).toBe("Znajomy");
  });
});

describe("secondaryHandleOf", () => {
  it("shows the handle only under a display name", () => {
    expect(secondaryHandleOf({ display_name: "Ania K.", username: "ania" })).toBe("@ania");
  });

  it("hides it when the handle is already the primary line", () => {
    expect(secondaryHandleOf({ display_name: null, username: "ania" })).toBeNull();
  });

  it("hides it when there is no handle", () => {
    expect(secondaryHandleOf({ display_name: "Ania K.", username: null })).toBeNull();
  });
});

describe("profileParamOf", () => {
  const id = "28d41df8-5f0a-4655-9a76-f65dab22aff4";

  it("uses the nick when there is one", () => {
    expect(profileParamOf({ username: "ania", id })).toBe("ania");
  });

  it("falls back to the id, which /u/$username also resolves", () => {
    expect(profileParamOf({ username: null, id })).toBe(id);
    expect(profileParamOf({ username: "", id })).toBe(id);
  });
});
