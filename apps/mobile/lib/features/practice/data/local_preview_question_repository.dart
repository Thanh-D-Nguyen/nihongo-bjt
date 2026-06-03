import 'package:nihongo_bjt/features/practice/domain/question.dart';
import 'package:nihongo_bjt/features/practice/domain/question_repository.dart';

/// Local, clearly-labeled **preview** practice questions.
///
/// Allowed temporary implementation (a local provider behind
/// [QuestionRepository]) used while no question backend exists for the mobile
/// app. Questions are hand-written, linguistically reviewed business Japanese
/// keyed to the preview lessons, with natural Vietnamese explanations. Every
/// question is flagged `isPreview` so the UI labels it honestly.
class LocalPreviewQuestionRepository implements QuestionRepository {
  const LocalPreviewQuestionRepository();

  static const Map<String, List<Question>> _byLesson = {
    'keigo-basics': [
      Question(
        id: 'keigo-q1',
        lessonId: 'keigo-basics',
        promptJa: '「言う」の尊敬語はどれですか。',
        promptReading: '「いう」のそんけいごはどれですか。',
        promptContextVi: 'Chọn dạng tôn kính ngữ (尊敬語) của động từ「言う」.',
        options: [
          QuestionOption(
            textJa: 'おっしゃる',
            reading: 'おっしゃる',
            glossVi: 'nói (tôn kính)',
          ),
          QuestionOption(
            textJa: '申す',
            reading: 'もうす',
            glossVi: 'nói (khiêm nhường)',
          ),
          QuestionOption(
            textJa: '申し上げる',
            reading: 'もうしあげる',
            glossVi: 'thưa (khiêm nhường)',
          ),
          QuestionOption(
            textJa: '拝見する',
            reading: 'はいけんする',
            glossVi: 'xem (khiêm nhường)',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「おっしゃる」là tôn kính ngữ của「言う」, dùng cho hành '
            'động của đối phương. 「申す」và「申し上げる」là khiêm nhường ngữ '
            'cho hành động của bản thân.',
      ),
      Question(
        id: 'keigo-q2',
        lessonId: 'keigo-basics',
        promptJa: '資料を自分が「見る」とき、謙譲語ではどう言いますか。',
        promptReading:
            'しりょうをじぶんが「みる」とき、'
            'けんじょうごではどういいますか。',
        promptContextVi:
            'Khi bản thân "xem" tài liệu, dùng khiêm nhường ngữ nào?',
        options: [
          QuestionOption(
            textJa: '拝見する',
            reading: 'はいけんする',
            glossVi: 'xem (khiêm nhường)',
          ),
          QuestionOption(
            textJa: 'ご覧になる',
            reading: 'ごらんになる',
            glossVi: 'xem (tôn kính)',
          ),
          QuestionOption(
            textJa: '見られる',
            reading: 'みられる',
            glossVi: 'có thể xem / được xem',
          ),
          QuestionOption(
            textJa: 'お見になる',
            reading: 'おみになる',
            glossVi: 'cách nói sai',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「拝見する」là khiêm nhường ngữ của「見る」, dùng cho '
            'hành động của bản thân. 「ご覧になる」là tôn kính ngữ dành cho '
            'đối phương.',
      ),
      Question(
        id: 'keigo-q3',
        lessonId: 'keigo-basics',
        promptJa: 'お客様が「来る」ときの尊敬語はどれですか。',
        promptReading: 'おきゃくさまが「くる」ときのそんけいごはどれですか。',
        promptContextVi: 'Khi khách "đến", dùng tôn kính ngữ nào?',
        options: [
          QuestionOption(
            textJa: 'いらっしゃる',
            reading: 'いらっしゃる',
            glossVi: 'đến/ở (tôn kính)',
          ),
          QuestionOption(
            textJa: '参る',
            reading: 'まいる',
            glossVi: 'đến (khiêm nhường)',
          ),
          QuestionOption(
            textJa: '伺う',
            reading: 'うかがう',
            glossVi: 'đến thăm (khiêm nhường)',
          ),
          QuestionOption(
            textJa: 'おる',
            reading: 'おる',
            glossVi: 'có/ở (khiêm nhường)',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「いらっしゃる」là tôn kính ngữ của「来る・行く・いる」, '
            'dùng cho khách. 「参る」và「伺う」là khiêm nhường ngữ cho bản thân.',
      ),
    ],
    'self-introduction': [
      Question(
        id: 'self-q1',
        lessonId: 'self-introduction',
        promptJa: '初対面の相手に最初に言う挨拶はどれですか。',
        promptReading: 'しょたいめんのあいてにさいしょにいうあいさつはどれですか。',
        promptContextVi: 'Câu chào đầu tiên khi gặp đối phương lần đầu là gì?',
        options: [
          QuestionOption(
            textJa: 'はじめまして',
            reading: 'はじめまして',
            glossVi: 'Rất hân hạnh được gặp',
          ),
          QuestionOption(
            textJa: 'お疲れ様です',
            reading: 'おつかれさまです',
            glossVi: 'Anh/chị vất vả rồi',
          ),
          QuestionOption(
            textJa: 'いただきます',
            reading: 'いただきます',
            glossVi: 'Mời (trước khi ăn)',
          ),
          QuestionOption(
            textJa: 'おかげさまで',
            reading: 'おかげさまで',
            glossVi: 'Nhờ ơn anh/chị',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「はじめまして」là câu chào dùng khi gặp lần đầu. '
            '「お疲れ様です」dùng với đồng nghiệp trong công việc hằng ngày.',
      ),
      Question(
        id: 'self-q2',
        lessonId: 'self-introduction',
        promptJa: '自分の名前を名乗るとき、「田中と___」に入る言葉はどれですか。',
        promptReading: 'じぶんのなまえをなのるとき、「たなかと___」にはいることばはどれですか。',
        promptContextVi: 'Khi xưng tên mình:「田中と___」điền từ nào?',
        options: [
          QuestionOption(
            textJa: '申します',
            reading: 'もうします',
            glossVi: 'tên là (khiêm nhường)',
          ),
          QuestionOption(
            textJa: 'おっしゃいます',
            reading: 'おっしゃいます',
            glossVi: 'nói (tôn kính)',
          ),
          QuestionOption(
            textJa: 'いらっしゃいます',
            reading: 'いらっしゃいます',
            glossVi: 'có/đến (tôn kính)',
          ),
          QuestionOption(
            textJa: 'ございます',
            reading: 'ございます',
            glossVi: 'có (lịch sự)',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「申します」là khiêm nhường ngữ của「言う」, dùng để xưng '
            'tên mình. 「おっしゃる」là tôn kính ngữ nên không dùng cho bản thân.',
      ),
    ],
    'meeting-expressions': [
      Question(
        id: 'meeting-q1',
        lessonId: 'meeting-expressions',
        promptJa: '会議で自分の意見を丁寧に述べたいとき、適切な表現はどれですか。',
        promptReading: 'かいぎでじぶんのいけんをていねいにのべたいとき、てきせつなひょうげんはどれですか。',
        promptContextVi: 'Cách lịch sự để trình bày ý kiến của mình trong họp?',
        options: [
          QuestionOption(
            textJa: '意見を申し上げてもよろしいでしょうか',
            glossVi: 'Tôi xin phép trình bày ý kiến được không ạ',
          ),
          QuestionOption(
            textJa: '意見をおっしゃってもいいですか',
            glossVi: 'dùng tôn kính ngữ cho bản thân (sai)',
          ),
          QuestionOption(
            textJa: '意見を言ってやってもいいか',
            glossVi: 'cách nói trịch thượng',
          ),
          QuestionOption(
            textJa: '意見を申されてもいいですか',
            glossVi: 'kết hợp sai kính ngữ',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「申し上げる」là khiêm nhường ngữ phù hợp khi nói về '
            'hành động của bản thân. 「おっしゃる」là tôn kính ngữ, không dùng '
            'cho chính mình.',
      ),
      Question(
        id: 'meeting-q2',
        lessonId: 'meeting-expressions',
        promptJa: '内容を確認させてもらいたいとき、丁寧な表現はどれですか。',
        promptReading:
            'ないようをかくにんさせてもらいたいとき、'
            'ていねいなひょうげんはどれですか。',
        promptContextVi:
            'Khi muốn xin phép xác nhận nội dung, câu nào lịch sự?',
        options: [
          QuestionOption(
            textJa: '確認させていただきます',
            reading: 'かくにんさせていただきます',
            glossVi: 'Cho phép tôi xác nhận',
          ),
          QuestionOption(
            textJa: '確認してあげます',
            reading: 'かくにんしてあげます',
            glossVi: 'Tôi xác nhận giúp (bề trên)',
          ),
          QuestionOption(
            textJa: '確認なさいます',
            reading: 'かくにんなさいます',
            glossVi: 'xác nhận (tôn kính, cho đối phương)',
          ),
          QuestionOption(
            textJa: '確認しろ',
            reading: 'かくにんしろ',
            glossVi: 'Hãy xác nhận (mệnh lệnh thô)',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「確認させていただきます」xin phép một cách khiêm nhường '
            'để bản thân thực hiện. 「なさる」là tôn kính ngữ dành cho đối phương.',
      ),
      Question(
        id: 'meeting-q3',
        lessonId: 'meeting-expressions',
        promptJa: '別の案を丁寧に提案するとき、適切な表現はどれですか。',
        promptReading: 'べつのあんをていねいにていあんするとき、てきせつなひょうげんはどれですか。',
        promptContextVi: 'Cách lịch sự để đề xuất một phương án khác?',
        options: [
          QuestionOption(
            textJa: '検討してみてはいかがでしょうか',
            glossVi: 'Hay là ta cân nhắc xem thế nào ạ',
          ),
          QuestionOption(
            textJa: '検討してみたらどうだ',
            glossVi: 'Thử cân nhắc xem sao (suồng sã)',
          ),
          QuestionOption(
            textJa: '検討しなさい',
            glossVi: 'Hãy cân nhắc đi (ra lệnh)',
          ),
          QuestionOption(
            textJa: '検討してくれ',
            glossVi: 'Cân nhắc giúp đi (thô)',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「いかがでしょうか」là cách đề xuất lịch sự, tôn trọng '
            'quyết định của đối phương. Các lựa chọn còn lại mang sắc thái ra '
            'lệnh hoặc suồng sã.',
      ),
    ],
    'business-email': [
      Question(
        id: 'email-q1',
        lessonId: 'business-email',
        promptJa: 'ビジネスメールの冒頭の挨拶として適切なのはどれですか。',
        promptReading: 'びじねすめーるのぼうとうのあいさつとしててきせつなのはどれですか。',
        promptContextVi: 'Câu chào mở đầu phù hợp cho email công việc là gì?',
        options: [
          QuestionOption(
            textJa: 'いつもお世話になっております',
            reading: 'いつもおせわになっております',
            glossVi: 'Cảm ơn anh/chị đã luôn giúp đỡ',
          ),
          QuestionOption(
            textJa: 'お疲れ様でした',
            reading: 'おつかれさまでした',
            glossVi: 'Anh/chị đã vất vả',
          ),
          QuestionOption(
            textJa: 'ご苦労様です',
            reading: 'ごくろうさまです',
            glossVi: 'Vất vả rồi (bề trên nói với cấp dưới)',
          ),
          QuestionOption(
            textJa: 'はじめまして',
            reading: 'はじめまして',
            glossVi: 'Rất hân hạnh được gặp',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「いつもお世話になっております」là câu mở đầu chuẩn mực '
            'trong email công việc. 「ご苦労様」chỉ dùng từ cấp trên xuống cấp '
            'dưới nên không phù hợp với khách hàng.',
      ),
      Question(
        id: 'email-q2',
        lessonId: 'business-email',
        promptJa: '確認をお願いする結びの表現として適切なのはどれですか。',
        promptReading: 'かくにんをおねがいするむすびのひょうげんとしててきせつなのはどれですか。',
        promptContextVi: 'Câu kết nhờ đối phương kiểm tra, câu nào phù hợp?',
        options: [
          QuestionOption(
            textJa: 'ご確認のほどよろしくお願いいたします',
            reading: 'ごかくにんのほどよろしくおねがいいたします',
            glossVi: 'Rất mong anh/chị kiểm tra giúp',
          ),
          QuestionOption(
            textJa: '確認してください',
            reading: 'かくにんしてください',
            glossVi: 'Hãy kiểm tra (hơi trực tiếp)',
          ),
          QuestionOption(
            textJa: '確認しろ',
            reading: 'かくにんしろ',
            glossVi: 'Kiểm tra đi (mệnh lệnh thô)',
          ),
          QuestionOption(
            textJa: '確認お願い',
            reading: 'かくにんおねがい',
            glossVi: 'Nhờ kiểm tra (cụt, thiếu lịch sự)',
          ),
        ],
        correctIndex: 0,
        explanationVi: '「ご確認のほどよろしくお願いいたします」là cách kết thúc '
            'trang trọng, phù hợp với khách hàng và cấp trên. Các lựa chọn còn '
            'lại quá trực tiếp hoặc thiếu lịch sự.',
      ),
    ],
  };

  @override
  Future<List<Question>> fetchQuestions(String lessonId) async {
    return _byLesson[lessonId] ?? const [];
  }
}
