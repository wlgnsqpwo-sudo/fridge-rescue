/**
 * ====================================================================
 * 냉장고 구조대 (FRIDGE RESCUE) - 백엔드 API 서버 (Node.js & Express)
 * ====================================================================
 * 주요 기능:
 * 1. 정적 파일 호스팅 (public/ 폴더)
 * 2. POST /api/analyze - 다중 냉장고 사진 업로드 및 OpenAI 기반 식재료 후보 추출
 * 3. POST /api/recipes - 사용자가 검토/확인한 재료 기반 요리 추천 3선 및 상세 레시피 생성
 * 4. POST /api/feedback - 로그인 없는 피드백 작성 및 Supabase 저장
 * 5. GET /api/feedback - 최신순 피드백 목록 조회
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const path = require('path');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// 1. 환경변수 로드 (.env 파일이 존재할 경우 로드)
dotenv.config();

// 2. Express 앱 초기화
const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 등록: JSON 파싱 및 CORS 설정
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일(HTML, CSS, JS) 제공 (로컬 실행 시)
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. Multer 설정 (메모리 스토리지)
// 규칙 준수: 사진은 디스크에 영구 저장하지 않고 메모리 버퍼에서 분석 후 즉시 정리됩니다.
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 파일당 최대 8MB 제한
    files: 5 // 최대 5개 파일
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 파일 형식입니다. JPG, PNG, WEBP 형식만 업로드 가능합니다.'));
    }
  }
});

// 4. OpenAI 클라이언트 인스턴스 초기화
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('서버에 OPENAI_API_KEY가 설정되어 있지 않습니다.');
  }
  return new OpenAI({ apiKey });
}

// 5. Supabase 클라이언트 인스턴스 초기화
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('서버에 SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 설정되어 있지 않습니다.');
  }
  return createClient(supabaseUrl, supabaseKey);
}

// ====================================================================
// [API 1] POST /api/analyze - 냉장고 사진 여러 장 AI 식재료 분석
// ====================================================================
app.post('/api/analyze', (req, res) => {
  // multer를 수동 래핑하여 파일 개수 및 용량 초과 에러를 친절한 한국어로 응답
  const uploadMiddleware = upload.array('images', 5);

  uploadMiddleware(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: '사진 크기는 1장당 최대 8MB까지만 업로드 가능합니다.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: '사진은 한 번에 최대 5장까지만 업로드할 수 있습니다.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `파일 업로드 오류: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || '사진 업로드 처리 중 오류가 발생했습니다.'
      });
    }

    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '분석할 사진을 최소 1장 이상 업로드해 주세요.'
        });
      }

      if (files.length > 5) {
        return res.status(400).json({
          success: false,
          message: '사진은 최대 5장까지 선택할 수 있습니다.'
        });
      }

      // OpenAI 인스턴스 및 모델 가져오기
      const openai = getOpenAIClient();
      const modelName = process.env.OPENAI_MODEL || 'gpt-4o';

      // 업로드된 이미지들을 OpenAI Vision 포맷(Base64 data URL)으로 변환
      const imageContents = files.map((file) => {
        const base64Data = file.buffer.toString('base64');
        return {
          type: 'image_url',
          image_url: {
            url: `data:${file.mimetype};base64,${base64Data}`
          }
        };
      });

      // AI 분석 시스템 및 유저 프롬프트 (PRD/AGENTS.md 규칙 엄격 준수)
      const systemPrompt = `당신은 냉장고 사진에서 식별 가능한 식재료를 정확하게 찾아내는 AI 보조원입니다.
다음 지침을 엄격히 준수하세요:
1. 사진에서 '실제로 육안으로 식별 가능한' 식재료 후보만 추출하세요.
2. 가려진 물체, 불투명한 용기/포장 안의 내용물, 조미료 성분, 정확한 상표/브랜드명을 억지로 추측하지 마세요.
3. 사진만으로 소비기한, 신선도, 상함 여부, 안전성, 알레르기 유발 물질을 절대로 판정하거나 단정하지 마세요.
4. 확실하게 보이는 것은 confidence를 "high", 다소 불확실하거나 일부만 보이는 것은 "medium" 또는 "low"로 지정하세요.
5. 반드시 아래 JSON 형식으로만 응답하세요. 다른 설명이나 마크다운 백틱 없이 순수 JSON만 반환하세요:
{
  "ingredients": [
    {
      "name": "재료명 (예: 대파, 달걀, 두부)",
      "confidence": "high" | "medium" | "low",
      "note": "식별 위치 또는 확인 필요 이유 (예: 야채실 투명 비닐 안, 포장 일부만 보여 확인 필요)"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '업로드된 냉장고 사진들을 분석하여 식별 가능한 식재료 후보 목록을 JSON으로 추출해 주세요.'
              },
              ...imageContents
            ]
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const responseText = response.choices[0]?.message?.content || '{}';
      const parsedData = JSON.parse(responseText);

      const ingredients = Array.isArray(parsedData.ingredients)
        ? parsedData.ingredients.map((item) => ({
            name: String(item.name || '').trim(),
            confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
            note: String(item.note || '')
          })).filter((item) => item.name.length > 0)
        : [];

      return res.json({
        success: true,
        ingredients: ingredients
      });
    } catch (error) {
      console.error('이미지 분석 처리 오류:', error.message);
      // 보안 준수: 스택 트레이스나 비밀 키를 노출하지 않고 사용자 친화적 메시지 전달
      return res.status(500).json({
        success: false,
        message: error.message.includes('OPENAI_API_KEY')
          ? '서버의 OpenAI API 키가 설정되지 않았습니다. 관리자에게 문의하세요.'
          : '사진 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      });
    }
  });
});

// ====================================================================
// [API 2] POST /api/recipes - 확인된 재료 기반 AI 요리 추천 및 상세 레시피
// ====================================================================
app.post('/api/recipes', async (req, res) => {
  try {
    const { ingredients, servings = 2, preference = '', useFirst = [] } = req.body;

    // 1. 입력값 유효성 검증
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        message: '요리 추천을 위해 최소 1개 이상의 재료를 선택하거나 입력해 주세요.'
      });
    }

    // 재료명 정제 (공백 제거 및 빈 문자열 제외)
    const cleanIngredients = ingredients.map((i) => String(i).trim()).filter(Boolean);
    if (cleanIngredients.length === 0) {
      return res.status(400).json({
        success: false,
        message: '유효한 식재료가 없습니다. 재료명을 확인해 주세요.'
      });
    }

    const cleanServings = parseInt(servings, 10);
    const validServings = isNaN(cleanServings) || cleanServings < 1 ? 2 : Math.min(cleanServings, 10);
    const cleanPreference = String(preference || '').trim().slice(0, 100);
    const cleanUseFirst = Array.isArray(useFirst)
      ? useFirst.map((i) => String(i).trim()).filter(Boolean)
      : [];

    // 2. OpenAI 클라이언트 및 모델
    const openai = getOpenAIClient();
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o';

    // 3. AI 프롬프트 구성 (요리 3개 추천 및 상세 레시피 포함)
    const prompt = `사용자가 보유하고 있다고 확인한 식재료 목록:
- 보유 식재료: [${cleanIngredients.join(', ')}]
- 인원수: ${validServings}인분
- 선호 음식 / 스타일: ${cleanPreference || '특별한 제한 없음'}
- 우선 소비 희망 재료: [${cleanUseFirst.join(', ')}]

위 조건을 바탕으로 만들 수 있는 최적의 요리 3가지를 추천하고 각 요리의 상세 레시피를 작성해 주세요.
지침:
1. 실제로 사용자가 보유한 재료(보유 식재료 목록에 있는 것)만 ownedIngredients에 넣으세요. 보유하지 않은 재료를 보유한 것처럼 거짓으로 넣으면 안 됩니다.
2. 양념류(소금, 간장, 식용유 등)나 추가로 있으면 좋은 재료는 extraIngredients에 명확히 구분해 넣으세요.
3. 만약 특정 재료를 다른 것으로 대체할 수 있다면 note나 reason에 친절히 안내하세요.
4. 조리 시간과 난이도, ${validServings}인분에 맞춘 재료별 상세 분량(예: 두부 1/2모, 달걀 2개), 순서가 있는 구체적인 조리 순서(steps)를 작성하세요.
5. 안내 문구에 조리 시간 및 분량은 참고용 추정치이며, 불확실한 재료는 위생과 안전을 위해 섭취하지 말라는 안내를 steps 앞뒤에 녹여내거나 팁으로 제공하세요.
6. 반드시 다음 JSON 구조로만 반환하세요:
{
  "recipes": [
    {
      "name": "요리명 (예: 두부 달걀국)",
      "reason": "추천 이유 (보유 재료 활용 포인트)",
      "ownedIngredients": ["보유 재료 중 사용되는 재료들"],
      "extraIngredients": ["추가로 필요한 양념 또는 식재료"],
      "timeMinutes": 15,
      "difficulty": "쉬움" | "보통" | "어려움",
      "ingredientAmounts": [
        {"name": "두부", "amount": "1/2모 (약 150g)"},
        {"name": "달걀", "amount": "2개"}
      ],
      "steps": [
        "1. 두부는 깍둑썰기하고 대파는 송송 썹니다.",
        "2. 냄비에 물 500ml를 넣고 끓입니다."
      ],
      "safetyTip": "재료의 신선도를 직접 확인하고, 상함이 의심되는 재료는 절대 사용하지 마세요."
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: '당신은 냉장고 속 남은 재료를 구조해 맛있는 집밥 요리를 제안하는 전문 셰프 AI입니다. 반드시 요구된 순수 JSON 형식으로만 응답하세요.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0]?.message?.content || '{}';
    const parsedData = JSON.parse(responseText);

    const recipes = Array.isArray(parsedData.recipes) ? parsedData.recipes : [];

    return res.json({
      success: true,
      recipes: recipes
    });
  } catch (error) {
    console.error('요리 추천 처리 오류:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message.includes('OPENAI_API_KEY')
        ? '서버의 OpenAI API 키가 설정되지 않았습니다.'
        : '요리 추천을 생성하는 도중 오류가 발생했습니다. 다시 시도해 주세요.'
    });
  }
});

// ====================================================================
// [API 3] POST /api/feedback - 로그인 없는 피드백 저장
// ====================================================================
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, message } = req.body;

    // 1. 유효성 검사 (message 필수 1~500자, name 선택 최대 30자)
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage || cleanMessage.length < 1 || cleanMessage.length > 500) {
      return res.status(400).json({
        success: false,
        message: '피드백 내용은 1자 이상 500자 이하로 작성해 주세요.'
      });
    }

    const cleanName = name ? String(name).trim().slice(0, 30) : null;

    // 2. Supabase DB에 저장
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('feedback')
      .insert([
        {
          name: cleanName || '익명의 구조대원',
          message: cleanMessage
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase 피드백 저장 오류:', error.message);
      return res.status(500).json({
        success: false,
        message: '피드백 저장 중 데이터베이스 오류가 발생했습니다.'
      });
    }

    return res.json({
      success: true,
      message: '소중한 피드백이 등록되었습니다. 감사합니다!',
      feedback: data
    });
  } catch (error) {
    console.error('피드백 저장 예외:', error.message);
    return res.status(500).json({
      success: false,
      message: '피드백 저장 처리에 실패했습니다.'
    });
  }
});

// ====================================================================
// [API 4] GET /api/feedback - 최신순 피드백 목록 조회
// ====================================================================
app.get('/api/feedback', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('feedback')
      .select('id, name, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50); // 최대 최근 50건 조회

    if (error) {
      console.error('Supabase 피드백 조회 오류:', error.message);
      return res.status(500).json({
        success: false,
        message: '피드백 목록을 불러오지 못했습니다.'
      });
    }

    return res.json({
      success: true,
      feedbacks: data || []
    });
  } catch (error) {
    console.error('피드백 조회 예외:', error.message);
    return res.status(500).json({
      success: false,
      message: '피드백 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 404 핸들러 (API 경로가 잘못된 경우)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청하신 API 엔드포인트를 찾을 수 없습니다.'
  });
});

// 로컬 환경에서 단독 실행 시 서버 포트 리슨
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🥦 냉장고 구조대(FRIDGE RESCUE) 서버가 실행되었습니다.`);
    console.log(`🌐 접속 주소: http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}

// Vercel Serverless Function 지원용 export
module.exports = app;

