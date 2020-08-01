const args = Deno.args;

export const CliArgument = {
  DRY_RUN: "--dry",
  METHOD: "--method",
  PORT: "--port",
};

export const hasOption = (option) => args.some((o) => o.indexOf(option) === 0);

export const optionValue = (option) => {
  if (!hasOption(option)) {
    throw new Error(`Option ${option} was not passed as an argument.`);
  }

  const cliOption = args.find((o) => o.indexOf(option) === 0);
  return cliOption.includes("=") ? cliOption.split("=")[1] : "";
};
