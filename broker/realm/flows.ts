/**
 * The Broker's authentication flows, read as the tree they are.
 *
 * The realm format declares them as a flat list: a flow holds a subflow by
 * naming it in a `flowAlias` string, and the order of a flow's executions is
 * their `priority` numbers. So the tree is a reconstruction, and the file
 * shows neither its shape nor a break in it.
 *
 * Both things here depend on that reconstruction. `checkFlows` is run by
 * `derive()`, so a break fails the image build rather than a sign-in.
 * `renderFlowTree` draws the tree `broker/README.md` carries, and a case in
 * `tests/realm-derivation.test.ts` holds the drawing to the declaration.
 */

import type { Realm } from "./derive.ts";

/** One step of a flow: an authenticator, or a subflow named by `flowAlias`. */
interface Execution {
  authenticator?: string;
  flowAlias?: string;
  requirement?: string;
  priority?: number;
}

interface Flow {
  alias: string;
  description?: string;
  topLevel?: boolean;
  authenticationExecutions?: Execution[];
}

/** An execution that declares no `priority` is a 0 like any other 0, so a
 *  missing one ties rather than being excused. */
const priorityOf = (execution: Execution) => execution.priority ?? 0;

/**
 * What every flow in the realm has to be true of, refused where the build can
 * still be stopped:
 *
 * - every `flowAlias` names a declared flow, because Keycloak imports a flow
 *   pointing at nothing without saying so;
 * - every declared flow is reached from exactly one execution, or is
 *   `topLevel`, because one nothing reaches is dead and reads as live;
 * - no two executions of one flow share a `priority`, because their order is
 *   then whatever Keycloak makes of a tie.
 */
export function checkFlows(realm: Realm): void {
  const flows = declaredFlows(realm);
  const declared = new Set(flows.map((flow) => flow.alias));
  const reached = new Map<string, number>();

  for (const flow of flows) {
    const priorities = new Set<number>();
    for (const execution of flow.authenticationExecutions ?? []) {
      if (priorities.has(priorityOf(execution))) {
        throw new Error(
          `Flow "${flow.alias}" gives two executions the priority ${priorityOf(execution)}, which leaves their order to Keycloak.`,
        );
      }
      priorities.add(priorityOf(execution));

      const subflow = execution.flowAlias;
      if (subflow === undefined) continue;
      if (!declared.has(subflow)) {
        throw new Error(
          `Flow "${flow.alias}" holds a subflow "${subflow}", which no flow declares.`,
        );
      }
      reached.set(subflow, (reached.get(subflow) ?? 0) + 1);
    }
  }

  for (const flow of flows) {
    if (flow.topLevel === true) continue;
    const count = reached.get(flow.alias) ?? 0;
    if (count === 0) {
      throw new Error(
        `Flow "${flow.alias}" is declared and nothing holds it, so it is dead. A subflow is reached from one execution; a flow reached from none is topLevel.`,
      );
    }
    if (count > 1) {
      throw new Error(
        `Flow "${flow.alias}" is held by ${count} executions, and a subflow is reached from one.`,
      );
    }
  }
}

/**
 * The flow named `rootAlias` as a tree, one execution per line, indented by
 * depth and ending in the requirement — the drawing `broker/README.md`
 * carries.
 */
export function renderFlowTree(realm: Realm, rootAlias: string): string {
  const declared = new Map(
    declaredFlows(realm).map((flow) => [flow.alias, flow]),
  );
  const root = declared.get(rootAlias);
  if (root === undefined) {
    throw new Error(`No flow is declared as "${rootAlias}".`);
  }

  const lines: { indent: string; name: string; requirement: string }[] = [
    { indent: "", name: rootAlias, requirement: "" },
  ];
  const walk = (flow: Flow, depth: number) => {
    const executions = (flow.authenticationExecutions ?? []).toSorted(
      (one, other) => priorityOf(one) - priorityOf(other),
    );
    for (const execution of executions) {
      const name = execution.flowAlias ?? execution.authenticator ?? "";
      lines.push({
        indent: "  ".repeat(depth),
        name,
        requirement: execution.requirement ?? "",
      });
      const subflow =
        execution.flowAlias === undefined
          ? undefined
          : declared.get(execution.flowAlias);
      if (subflow !== undefined) walk(subflow, depth + 1);
    }
  };
  walk(root, 1);

  const column =
    Math.max(
      ...lines
        .filter((line) => line.requirement !== "")
        .map((line) => line.indent.length + line.name.length),
    ) + 2;
  return lines
    .map(({ indent, name, requirement }) =>
      requirement === ""
        ? `${indent}${name}`
        : `${indent}${name}`.padEnd(column) + requirement,
    )
    .join("\n");
}

const declaredFlows = (realm: Realm): Flow[] =>
  (realm["authenticationFlows"] ?? []) as Flow[];
