Component({
  options: { styleIsolation: "apply-shared" },
  properties: {
    label: { type: String, value: "" },
    value: { type: String, value: "" },
    hint: { type: String, value: "" },
    tone: { type: String, value: "green" },
  },
});
