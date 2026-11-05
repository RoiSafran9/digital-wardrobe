import { cachedItems, forgetItems, rememberItems } from "../src/store/itemsCache";

const items = [{ item_id: "a" }] as never[];

test("the remembered closet is only handed back to the account it belongs to", () => {
  rememberItems("user-1", items);
  expect(cachedItems("user-1")).toBe(items);
  expect(cachedItems("user-2")).toBeNull();
  expect(cachedItems(null)).toBeNull();  // local mode never sees an account's closet
  forgetItems();
  expect(cachedItems("user-1")).toBeNull();
});
