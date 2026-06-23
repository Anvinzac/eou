const fs = require('fs');

const updateLocale = (file, data) => {
  let content = {};
  try {
    content = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch(e) {}
  
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
  packs: {
    quick_start: "Quick Start Packs",
    custom_description: "Take the wheel! Randomly pick questions, shuffle ones you don't like, or write your own.",
    custom_btn: "Build Custom Quiz",
    browse_category: "Or Browse by Category",
    curated_description: "Hand-picked collections of 10 questions to get you started instantly.",
    pack_mixed: "Mixed Bag",
    pack_mixed_desc: "A little bit of everything. The perfect all-rounder.",
    pack_deep: "Deep Conversations",
    pack_deep_desc: "Values, emotions, and life goals.",
    pack_fun: "Fun & Quirky",
    pack_fun_desc: "Lighthearted questions and hypothetical scenarios."
  },
  take_quiz: {
    loading: "Loading quiz...",
    not_found: "Quiz not found",
    start: "Start Quiz",
    question: "Question {{current}} of {{total}}",
    submitting: "Analyzing results..."
  },
  dashboard: {
    title: "My Quizzes",
    empty: "You haven't created any quizzes yet.",
    create_first: "Create Your First Quiz",
    active: "Active",
    copy_link: "Copy Link",
    results: "Results",
    copied: "Link copied to clipboard!",
    recent_responses: "Recent Responses"
  },
  auth: {
    welcome: "Welcome Back",
    desc: "Sign in to manage your quizzes and see who knows you best.",
    google: "Continue with Google",
    email: "Sign in with Email"
  }
};

const viData = {
  packs: {
    quick_start: "Gói Cố Định",
    custom_description: "Làm chủ! Chọn câu hỏi ngẫu nhiên, đổi câu bạn không thích, hoặc tự viết.",
    custom_btn: "Tạo bài tùy chỉnh",
    browse_category: "Hoặc Duyệt theo Hạng Mục",
    curated_description: "Bộ sưu tập 10 câu hỏi được chọn lọc kỹ càng để bắt đầu ngay lập tức.",
    pack_mixed: "Hỗn Hợp",
    pack_mixed_desc: "Mỗi thứ một chút. Sự lựa chọn hoàn hảo và đa dạng.",
    pack_deep: "Trò Chuyện Sâu Sắc",
    pack_deep_desc: "Giá trị cốt lõi, cảm xúc, và mục tiêu sống.",
    pack_fun: "Vui Nhộn & Độc Đáo",
    pack_fun_desc: "Các câu hỏi nhẹ nhàng và các tình huống giả định."
  },
  take_quiz: {
    loading: "Đang tải bài kiểm tra...",
    not_found: "Không tìm thấy bài kiểm tra",
    start: "Bắt Đầu",
    question: "Câu hỏi {{current}} / {{total}}",
    submitting: "Đang phân tích kết quả..."
  },
  dashboard: {
    title: "Bài Kiểm Tra Của Tôi",
    empty: "Bạn chưa tạo bài kiểm tra nào.",
    create_first: "Tạo Bài Đầu Tiên",
    active: "Đang hoạt động",
    copy_link: "Sao chép liên kết",
    results: "Kết quả",
    copied: "Đã sao chép liên kết!",
    recent_responses: "Phản hồi gần đây"
  },
  auth: {
    welcome: "Chào mừng trở lại",
    desc: "Đăng nhập để quản lý bài kiểm tra và xem ai hiểu bạn nhất.",
    google: "Tiếp tục với Google",
    email: "Đăng nhập bằng Email"
  }
};

updateLocale('src/i18n/locales/en.json', enData);
updateLocale('src/i18n/locales/vi.json', viData);
console.log('Locales updated');
