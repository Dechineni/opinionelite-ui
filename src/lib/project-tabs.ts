export function getProjectTabs(opts: {
  preScreen: boolean;
  quotasEnabled: boolean;
}) {
  return {
    showPreScreen: opts.preScreen,
    showQuotas: opts.quotasEnabled,
  };
}
