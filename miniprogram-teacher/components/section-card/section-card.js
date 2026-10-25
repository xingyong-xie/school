Component({
  options: {
    styleIsolation: "apply-shared",
    multipleSlots: true,
  },
  properties: {
    title: { type: String, value: "" },
    loading: { type: Boolean, value: false },
  },
});
