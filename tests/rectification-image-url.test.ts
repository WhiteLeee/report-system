import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRectificationImageUrl } from "@/backend/rectification/rectification.service";

test("normalizeRectificationImageUrl strips OSS signature query params", () => {
  const signedUrl =
    "https://ruipos-hyy.ruipos.com/ruipos-RLS/cos3-ri-video/202604/1775040085411-1-capture.jpg?Expires=1775126486&OSSAccessKeyId=LTAI5t86mBySpBKVbHEG2ZTa&Signature=3WOuTz5UvyVaVahFWJbnO%2BlySlA%3D";

  assert.equal(
    normalizeRectificationImageUrl(signedUrl),
    "https://ruipos-hyy.ruipos.com/ruipos-RLS/cos3-ri-video/202604/1775040085411-1-capture.jpg"
  );
});

test("normalizeRectificationImageUrl keeps unsigned URLs unchanged", () => {
  const plainUrl =
    "https://ruipos-hyy.ruipos.com/ruipos-RLS/cos3-ri-video/202604/1775040085411-1-capture.jpg";

  assert.equal(normalizeRectificationImageUrl(plainUrl), plainUrl);
});
