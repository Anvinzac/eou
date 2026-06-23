const fs = require('fs');

const updateLocale = (file, data) => {
  const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
  
  const merge = (target, source) => {
    for (const key of Object.keys(source)) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        merge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  };

  merge(content, data);
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
};

const enData = {
  create_quiz: {
    toast: {
      enter_correct: "Please enter a correct answer first to generate distractors",
      distractors_generated: "Distractors generated!",
      distractors_failed: "Failed to generate distractors",
      no_more_shuffle: "No more questions to shuffle!",
      enter_both: "Please enter both question and answer",
      profanity: "Please use appropriate language",
      provide_distractors: "Please provide or generate 3 distractors",
      draft_saved: "Quiz saved as draft! Sign in to manage it.",
      draft_failed: "Failed to save draft",
      saved: "Quiz saved successfully!",
      save_failed: "Failed to save quiz"
    },
    header: {
      back: "Back",
      choose_pack: "Choose a Pack",
      question_progress: "Question {{current}} of {{total}}",
      quiz_ready: "Quiz Ready!"
    },
    custom: {
      title: "Write Your Own",
      question_label: "Question",
      question_placeholder: "e.g. What's my secret talent?",
      correct_label: "Correct Answer",
      correct_placeholder: "e.g. Juggling",
      distractors_label: "Distractors (Incorrect Options)",
      refresh: "Refresh",
      distractor_placeholder: "Distractor {{index}}",
      use_question: "Use Question"
    },
    play: {
      shuffle: "Shuffle",
      write_own: "Write My Own",
      finish_now: "Finish Quiz Now ({{count}}/10 selected)"
    },
    review: {
      title: "Quiz Ready!",
      subtitle: "You've locked in {{count}} questions.",
      name_label: "Give your quiz a name",
      save_continue: "Save Quiz & Continue",
      signin_desc: "Sign in to share your quiz and see results.",
      save_signin: "Save & Sign In"
    }
  }
};

const viData = {
  create_quiz: {
    toast: {
      enter_correct: "Vui lòng nhập câu trả lời đúng trước để tạo đáp án nhiễu",
      distractors_generated: "Đã tạo đáp án nhiễu!",
      distractors_failed: "Không thể tạo đáp án nhiễu",
      no_more_shuffle: "Không còn câu hỏi nào để xáo trộn!",
      enter_both: "Vui lòng nhập cả câu hỏi và câu trả lời",
      profanity: "Vui lòng sử dụng ngôn từ phù hợp",
      provide_distractors: "Vui lòng cung cấp hoặc tạo 3 đáp án nhiễu",
      draft_saved: "Đã lưu bản nháp! Đăng nhập để quản lý.",
      draft_failed: "Lưu bản nháp thất bại",
      saved: "Đã lưu bài kiểm tra thành công!",
      save_failed: "Lưu bài kiểm tra thất bại"
    },
    header: {
      back: "Quay lại",
      choose_pack: "Chọn một gói",
      question_progress: "Câu hỏi {{current}} / {{total}}",
      quiz_ready: "Đã sẵn sàng!"
    },
    custom: {
      title: "Tự viết câu hỏi",
      question_label: "Câu hỏi",
      question_placeholder: "VD: Tài lẻ bí mật của tôi là gì?",
      correct_label: "Câu trả lời đúng",
      correct_placeholder: "VD: Tung hứng",
      distractors_label: "Đáp án nhiễu (Sai)",
      refresh: "Tạo lại",
      distractor_placeholder: "Đáp án nhiễu {{index}}",
      use_question: "Sử dụng câu hỏi này"
    },
    play: {
      shuffle: "Đổi câu khác",
      write_own: "Tự viết câu hỏi",
      finish_now: "Hoàn tất ngay (đã chọn {{count}}/10)"
    },
    review: {
      title: "Đã sẵn sàng!",
      subtitle: "Bạn đã chốt {{count}} câu hỏi.",
      name_label: "Đặt tên cho bài kiểm tra của bạn",
      save_continue: "Lưu & Tiếp tục",
      signin_desc: "Đăng nhập để chia sẻ bài kiểm tra và xem kết quả.",
      save_signin: "Lưu & Đăng nhập"
    }
  }
};

updateLocale('src/i18n/locales/en.json', enData);
updateLocale('src/i18n/locales/vi.json', viData);
console.log('Locales updated');
