/**
 * Workflow-stage automation: validate on entry, then advance or divert.
 * Adapt: the role the user named, workflow and stage IDs, the validation, and the target stage names.
 * A `workflow.transition` payload carries no content type — filter on IDs; type-check in the handler.
 * Transition 409 retry lives in [sdk-api.md](../references/sdk-api.md).
 */
import { defineAutomation } from '@uniformdev/automations-sdk';
import { EntryManagementClient, WorkflowClient, convertEntryToPutEntry } from '@uniformdev/canvas';

const WORKFLOW_ID = '00000000-0000-0000-0000-000000000001';
const VALIDATION_STAGE_ID = '00000000-0000-0000-0000-000000000002';

const APPROVED_STAGE_PREFIX = 'Ready';
const REJECTED_STAGE_PREFIX = 'Needs work';

export default defineAutomation({
  metadata: {
    name: 'Validate content entering review',
    description: 'Checks required fields when content enters the Validation stage and advances or diverts it.',
    triggers: [
      {
        type: 'workflow.transition',
        filter: `input.newStage.workflowId == "${WORKFLOW_ID}" && input.newStage.stageId == "${VALIDATION_STAGE_ID}"`,
      },
    ],
    permissions: { role: 'developer' },
  },
  handler: async ({ input, log, uniformCredentials }) => {
    if (input.entity.type !== 'entry') {
      log.info(`Ignoring a ${input.entity.type} transition; this automation only handles entries.`);
      return { outcome: 'rejected' };
    }

    const entries = new EntryManagementClient(uniformCredentials);
    const fresh = await entries.get({ entryId: input.entity.id, pattern: 'any' });

    const problems = validate(fresh.entry.fields);
    const targetPrefix = problems.length === 0 ? APPROVED_STAGE_PREFIX : REJECTED_STAGE_PREFIX;
    const target = await resolveConnectedStage(uniformCredentials, WORKFLOW_ID, VALIDATION_STAGE_ID, targetPrefix);

    if (!target) {
      // No reachable stage with that name: report it and leave the entity where a human can see it.
      log.warning(`No stage starting with "${targetPrefix}" is reachable from Validation; leaving the entry in place.`);
      return { outcome: 'failure' };
    }

    await entries.save(
      { ...convertEntryToPutEntry(fresh), workflowId: WORKFLOW_ID, workflowStageId: target.stageId },
      { ifUnmodifiedSince: fresh.modified }
    );

    if (problems.length === 0) {
      log.info(`"${input.entity.name}" passed validation and moved to "${target.stageName}".`);
    } else {
      log.warning(`"${input.entity.name}" moved to "${target.stageName}": ${problems.join('; ')}`);
    }

    return { outcome: 'success' };
  },
});

type EntryField = { value?: unknown; locales?: Record<string, unknown> };

/** Replace with the checks that matter for your content. A field is `{ value }` or `{ locales }`; read both. */
function readFieldValue(field: EntryField | undefined, locale: string): unknown {
  if (!field) return undefined;
  if (field.locales) return field.locales[locale];
  return field.value;
}

function validate(fields: Record<string, EntryField> | undefined): string[] {
  const problems: string[] = [];
  if (!readFieldValue(fields?.summary, 'en-US')) {
    problems.push('the summary is empty');
  }
  return problems;
}

async function resolveConnectedStage(
  credentials: ConstructorParameters<typeof WorkflowClient>[0],
  workflowId: string,
  fromStageId: string,
  namePrefix: string
): Promise<{ stageId: string; stageName: string } | undefined> {
  const { results } = await new WorkflowClient(credentials).list();
  const workflow = results.find((candidate) => candidate.id === workflowId);
  const current = workflow?.stages?.[fromStageId];

  for (const transition of current?.transitions ?? []) {
    const target = workflow?.stages?.[transition.to];
    if (target?.name.toLowerCase().startsWith(namePrefix.toLowerCase())) {
      return { stageId: transition.to, stageName: target.name };
    }
  }

  return undefined;
}
