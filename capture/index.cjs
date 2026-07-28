import("./capture.test.mjs").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
