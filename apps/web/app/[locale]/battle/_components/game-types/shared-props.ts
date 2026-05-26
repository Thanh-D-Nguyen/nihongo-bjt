import type { AnswerResultEvent, QuestionEvent } from "../battle-types";

export type GameTypeRoundProps = {
  answerPending: boolean;
  answerResult: AnswerResultEvent | null;
  canAnswer: boolean;
  onSubmitAnswer: (optionKey: string) => void;
  round: QuestionEvent;
  selectedOptionKey: string | null;
  timeLeft: number | null;
};
