export const type = "evenio_control";
export const label = "Evenio Control";

export const agentConfigurationDoc = `# evenio_control agent configuration

Adapter: evenio_control

Purpose:
- hand a Paperclip run into the private Evenio bounded workspace;
- preserve Paperclip run identity without granting generic shell or operator authority;
- use the dedicated loopback-only Evenio delegation ingress.

Security invariants:
- endpoint is fixed to http://127.0.0.1:18180/api/delegation/execute;
- bearer credential is read only from EVENIO_DELEGATION_TOKEN;
- only workspace_write is requested;
- each Paperclip run maps to one deterministic Evenio delegation task and workspace path;
- no Git transport, arbitrary URL, custom headers, command execution, publication, spend or public mutation.

Config:
- maxWriteBytes (number, optional): delegated content ceiling, default 65536,
  maximum 131072.
`;
