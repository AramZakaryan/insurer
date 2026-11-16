import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, isToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import type { ClaimView, Decision } from '../shared/contracts.ts';

export class StubModel extends BaseChatModel {
  step = 0;
  view: ClaimView | undefined;
  answer: Decision | undefined;
  constructor() {
    super({});
  }
  _llmType() {
    return 'pilot-test-stub';
  }
  bindTools() {
    return this;
  }
  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const call = (name: string, args: Record<string, unknown>) =>
      new AIMessage({
        content: '',
        tool_calls: [
          { name, args, id: `stub-${this.step}`, type: 'tool_call' },
        ],
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 10,
          total_tokens: 20,
        },
        response_metadata: { cost: 0 },
      });
    let message: AIMessage;
    if (this.step === 0) message = call('get_claim', {});
    else if (this.step === 1) {
      const result = messages.find(
        (message) => isToolMessage(message) && message.name === 'get_claim',
      );
      this.view = JSON.parse(String(result?.content)) as ClaimView;
      if (this.view.claim.summary.includes('Failure'))
        throw new Error('Stub model failed. Retry the claim.');
      message = call('get_policy', {});
    } else if (this.step === 2) message = call('get_claim_history', {});
    else if (this.step === 3) {
      if (!this.view) throw new Error('Stub did not receive the claim.');
      const decision = this.view.claim.summary.includes('Decline')
        ? 'decline'
        : this.view.claim.summary.includes('Referral')
          ? 'refer'
          : 'approve';
      this.answer = {
        decision,
        payout: decision === 'approve' ? this.view.claim.amount_claimed : 0,
        rationale:
          'The supplied test evidence was checked against section 3. This is a stub response for automated tests.',
      };
      message = call('record_decision', this.answer);
    } else if (this.step === 4 && this.answer?.decision === 'approve')
      message = call('pay_claim', { amount: this.answer.payout, revision: 1 });
    else
      message = new AIMessage({
        content:
          'Decision recorded. Any required handler sign-off remains outstanding.',
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 10,
          total_tokens: 20,
        },
        response_metadata: { cost: 0 },
      });
    this.step++;
    return { generations: [{ message, text: String(message.content) }] };
  }
}
