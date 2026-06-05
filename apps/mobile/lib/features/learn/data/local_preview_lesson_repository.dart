import 'package:nihongo_bjt/features/learn/domain/lesson.dart';
import 'package:nihongo_bjt/features/learn/domain/lesson_repository.dart';

/// Local, clearly-labeled **preview** Learn content.
///
/// This is an allowed temporary implementation (a local provider behind the
/// [LessonRepository] interface) used while no lesson backend exists for the
/// mobile app. The content is hand-written and linguistically reviewed
/// business Japanese with natural Vietnamese support; every lesson is flagged
/// `isPreview` so the UI can label it honestly. No fabricated backend, no fake
/// progress. Reads are async to match the real repository contract.
class LocalPreviewLessonRepository implements LessonRepository {
  const LocalPreviewLessonRepository();

  static const List<LessonCategory> _categories = [
    LessonCategory(
      id: 'workplace-comms',
      titleVi: 'Giao tiếp nơi làm việc',
      descriptionVi: 'Lịch sự, giới thiệu và xưng hô trong công việc.',
    ),
    LessonCategory(
      id: 'meetings-email',
      titleVi: 'Họp và email',
      descriptionVi: 'Diễn đạt trong cuộc họp và viết email công việc.',
    ),
  ];

  static const List<Lesson> _lessons = [
    Lesson(
      id: 'keigo-basics',
      categoryId: 'workplace-comms',
      titleJa: '敬語の基本',
      titleReading: 'けいごのきほん',
      summaryVi: 'Phân biệt tôn kính ngữ và khiêm nhường ngữ trong công sở.',
      level: LessonLevel.foundational,
      estimatedMinutes: 6,
      questionCount: 3,
      sections: [
        LessonSection(
          headingVi: 'Tôn kính ngữ và khiêm nhường ngữ',
          bodyJa:
              '尊敬語は相手の動作を高めて敬意を表します。'
              '謙譲語は自分の動作を低めて、相手を立てる表現です。',
          translationVi:
              'Tôn kính ngữ nâng hành động của đối phương lên để '
              'bày tỏ sự kính trọng. Khiêm nhường ngữ hạ thấp hành động của '
              'bản thân để tôn trọng đối phương.',
        ),
        LessonSection(
          headingVi: 'Ví dụ thường gặp',
          bodyJa:
              '「言う」は、尊敬語で「おっしゃる」、'
              '謙譲語で「申す」になります。',
          translationVi:
              'Động từ「言う」(nói) ở dạng tôn kính ngữ là '
              '「おっしゃる」, còn dạng khiêm nhường ngữ là「申す」.',
        ),
        LessonSection(
          headingVi: 'Lưu ý khi dùng',
          bodyJa:
              '相手には尊敬語、自分には謙譲語を使い、'
              '二つを混同しないように気をつけましょう。',
          translationVi:
              'Dùng tôn kính ngữ cho đối phương và khiêm nhường '
              'ngữ cho bản thân; chú ý không nhầm lẫn hai loại với nhau.',
        ),
      ],
    ),
    Lesson(
      id: 'self-introduction',
      categoryId: 'workplace-comms',
      titleJa: '自己紹介',
      titleReading: 'じこしょうかい',
      summaryVi: 'Cách giới thiệu bản thân khi gặp đối tác lần đầu.',
      level: LessonLevel.foundational,
      estimatedMinutes: 5,
      questionCount: 2,
      sections: [
        LessonSection(
          headingVi: 'Mở đầu lịch sự',
          bodyJa:
              'はじめまして。'
              '株式会社さくらの田中と申します。',
          translationVi:
              'Rất hân hạnh được gặp anh/chị. Tôi tên là Tanaka, '
              'đến từ công ty Sakura.',
        ),
        LessonSection(
          headingVi: 'Kết thúc phần chào hỏi',
          bodyJa:
              '本日はお時間をいただき、'
              'ありがとうございます。よろしくお願いいたします。',
          translationVi:
              'Cảm ơn anh/chị đã dành thời gian hôm nay. '
              'Rất mong được hợp tác.',
        ),
      ],
    ),
    Lesson(
      id: 'meeting-expressions',
      categoryId: 'meetings-email',
      titleJa: '会議での表現',
      titleReading: 'かいぎでのひょうげん',
      summaryVi: 'Cách phát biểu, xác nhận và đề xuất trong cuộc họp.',
      level: LessonLevel.practical,
      estimatedMinutes: 7,
      questionCount: 3,
      sections: [
        LessonSection(
          headingVi: 'Nêu ý kiến',
          bodyJa: '私の意見を申し上げてもよろしいでしょうか。',
          translationVi:
              'Tôi xin phép được trình bày ý kiến của mình có '
              'được không ạ?',
        ),
        LessonSection(
          headingVi: 'Xác nhận lại nội dung',
          bodyJa:
              '念のため、確認させていただきます。'
              '納期は来週の金曜日でよろしいですか。',
          translationVi:
              'Để chắc chắn, cho tôi xác nhận lại. Thời hạn giao '
              'là thứ Sáu tuần sau, đúng không ạ?',
        ),
        LessonSection(
          headingVi: 'Đề xuất một cách lịch sự',
          bodyJa: 'もしよろしければ、別の案も検討してみてはいかがでしょうか。',
          translationVi:
              'Nếu được, hay là chúng ta cùng cân nhắc thêm một '
              'phương án khác thì sao ạ?',
        ),
      ],
    ),
    Lesson(
      id: 'business-email',
      categoryId: 'meetings-email',
      titleJa: 'ビジネスメール',
      titleReading: 'びじねすめーる',
      summaryVi: 'Viết email công việc rõ ràng, đúng phép lịch sự.',
      level: LessonLevel.practical,
      estimatedMinutes: 6,
      questionCount: 2,
      sections: [
        LessonSection(
          headingVi: 'Câu mở đầu',
          bodyJa:
              'いつもお世話になっております。'
              'さくら商事の田中です。',
          translationVi:
              'Cảm ơn anh/chị đã luôn quan tâm giúp đỡ. Tôi là '
              'Tanaka từ công ty thương mại Sakura.',
        ),
        LessonSection(
          headingVi: 'Câu kết thúc',
          bodyJa:
              'お忙しいところ恐れ入りますが、'
              'ご確認のほどよろしくお願いいたします。',
          translationVi:
              'Xin lỗi vì đã làm phiền khi anh/chị đang bận, '
              'rất mong anh/chị kiểm tra giúp.',
        ),
      ],
    ),
  ];

  @override
  Future<List<LessonCategory>> fetchCategories() async => _categories;

  @override
  Future<List<Lesson>> fetchLessons() async => _lessons;

  @override
  Future<Lesson?> fetchLesson(String id) async {
    for (final lesson in _lessons) {
      if (lesson.id == id) return lesson;
    }
    return null;
  }
}
