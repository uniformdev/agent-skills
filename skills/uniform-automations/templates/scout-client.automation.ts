/**
 * Hybrid automation: deterministic code with one AI step.
 * Adapt: the role the user named, workflow and stage IDs, the schema, the prompt, and the fields written back.
 */
import { defineAutomation, type AutomationLogger } from '@uniformdev/automations-sdk';
import { ScoutClient } from '@uniformdev/automations-sdk/ai';
import { ApiClientError, EntryManagementClient, WorkflowClient, convertEntryToPutEntry } from '@uniformdev/canvas';
import * as z from 'zod';

const WORKFLOW_ID = '00000000-0000-0000-0000-000000000001';
const ENRICHMENT_STAGE_ID = '00000000-0000-0000-0000-000000000003';

const ENRICHED_STAGE_PREFIX = 'Ready';
const FAILED_STAGE_PREFIX = 'Needs work';

const EnrichmentSchema = z.object({
  metaTitle: z.string().describe('Under 60 characters. Plain text, no quotes, no brand suffix.'),
  metaDescription: z.string().describe('Between 140 and 160 characters. One sentence, active voice.'),
});

export default defineAutomation({
  metadata: {
    name: 'AI SEO enrichment',
    description: 'Generates meta title and description for content entering the Enrichment stage.',
    triggers: [
      {
        type: 'workflow.transition',
        filter: `input.newStage.workflowId == "${WORKFLOW_ID}" && input.newStage.stageId == "${ENRICHMENT_STAGE_ID}"`,
      },
    ],
    permissions: { role: 'developer' },
  },
  handler: async ({ input, log, uniformCredentials }) => {
    if (input.entity.type !== 'entry') {
      return { outcome: 'rejected' };
    }

    const entries = new EntryManagementClient(uniformCredentials);
    const entryId = input.entity.id;

    const before = await entries.get({ entryId, pattern: 'any' });

    // Check before spending. Skipping generation is not skipping the transition — this is `success`.
    if (before.entry.fields?.metaTitle?.value && before.entry.fields?.metaDescription?.value) {
      log.info('Meta fields are already populated; advancing without spending credits.');
      await transitionOut(entries, uniformCredentials, entryId, ENRICHED_STAGE_PREFIX, log);
      return { outcome: 'success' };
    }

    let enrichment: z.infer<typeof EnrichmentSchema>;
    try {
      const result = await new ScoutClient(uniformCredentials).invoke({
        message: [
          `Read the Uniform entry ${entryId} and write SEO metadata for it.`,
          'Base it only on the entry content. Do not invent product claims.',
          'Record your answer as structured output.',
        ].join('\n'),
        outputSchema: EnrichmentSchema,
      });
      enrichment = result.structuredOutput;
    } catch (error) {
      log.error(`Scout could not produce SEO metadata: ${error instanceof Error ? error.message : String(error)}`);
      await transitionOut(entries, uniformCredentials, entryId, FAILED_STAGE_PREFIX, log);
      return { outcome: 'failure' };
    }

    // Re-read before writing. Scout may have written to the entry itself, and its writes reach
    // the read edge slightly after `invoke` resolves, so `before.modified` is already stale.
    const fresh = await entries.get({ entryId, pattern: 'any' });
    const body = convertEntryToPutEntry(fresh);

    body.entry.fields = {
      ...body.entry.fields,
      metaTitle: { type: 'text', value: enrichment.metaTitle },
      metaDescription: { type: 'text', value: enrichment.metaDescription },
    };

    await entries.save(body, { ifUnmodifiedSince: fresh.modified });

    log.info(`Wrote SEO metadata to "${input.entity.name}".`);

    await transitionOut(entries, uniformCredentials, entryId, ENRICHED_STAGE_PREFIX, log);

    return { outcome: 'success' };
  },
});

/**
 * Moves the entry to a reachable stage. Re-reads before saving (a preceding write leaves
 * `modified` stale). A 409 is retried; failing to transition is logged, never thrown.
 */
async function transitionOut(
  entries: EntryManagementClient,
  credentials: ConstructorParameters<typeof WorkflowClient>[0],
  entryId: string,
  namePrefix: string,
  log: AutomationLogger
): Promise<void> {
  const target = await resolveConnectedStage(credentials, WORKFLOW_ID, ENRICHMENT_STAGE_ID, namePrefix);

  if (!target) {
    log.warning(`No stage starting with "${namePrefix}" is reachable from Enrichment; leaving the entry in place.`);
    return;
  }

  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const fresh = await entries.get({ entryId, pattern: 'any' });

    try {
      await entries.save(
        { ...convertEntryToPutEntry(fresh), workflowId: WORKFLOW_ID, workflowStageId: target.stageId },
        { ifUnmodifiedSince: fresh.modified }
      );
      log.info(`Moved the entry to "${target.stageName}".`);
      return;
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.statusCode !== 409) {
        throw error;
      }
      log.info(`The move to "${target.stageName}" hit a concurrent edit (attempt ${attempt} of ${attempts}).`);
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  log.warning(`Could not move the entry to "${target.stageName}"; it is still in Enrichment.`);
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
