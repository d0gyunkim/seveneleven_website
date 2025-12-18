import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { analysisType, data } = await request.json()
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // 프롬프트 생성
    let prompt = ''
    
    if (analysisType === '판매패턴') {
      const { myStoreData, comparisonData, categories, similarityScore, categoryDiffs, isAverage } = data
      const comparisonLabel = isAverage ? '유사매장 평균' : '유사매장'
      
      prompt = `다음은 편의점 매장의 카테고리별 판매 패턴 데이터입니다. 주어진 데이터를 기반으로 깊이 있는 유사도 분석을 수행해주세요. 반드시 제공된 데이터만을 근거로 분석하고, 맥락을 벗어나지 마세요.

내 매장 판매 비중:
${categories.map((cat: string) => `- ${cat}: ${myStoreData[cat]?.toFixed(2) || 0}%`).join('\n')}

${comparisonLabel} 판매 비중:
${categories.map((cat: string) => `- ${cat}: ${comparisonData[cat]?.toFixed(2) || 0}%`).join('\n')}

유사도 점수: ${similarityScore.toFixed(0)}%
카테고리별 차이:
${categoryDiffs.map((item: any) => `- ${item.category}: ${item.diff.toFixed(2)}%p`).join('\n')}

위 데이터를 기반으로 다음을 포함한 깊이 있는 분석 텍스트를 작성해주세요:
1. 전체적인 유사도 평가 (점수를 구체적으로 언급)
2. 가장 유사한 카테고리와 그 이유
3. 차이가 있는 카테고리와 그 의미
4. 고객층 및 상권 특성에 대한 구체적인 인사이트

중요: 반드시 제공된 수치 데이터만을 근거로 분석하고, 추측하거나 일반적인 내용을 추가하지 마세요. 각 카테고리의 구체적인 수치를 언급하며 분석하세요. 핵심만 담아 정확히 2줄로만 작성해주세요.`
    } else if (analysisType === '시간대패턴') {
      const { myStoreData, comparisonData, timeSlots, timeType, isAverage } = data
      const comparisonLabel = isAverage ? '유사매장 평균' : '유사매장'
      
      prompt = `다음은 편의점 매장의 ${timeType} 시간대별 판매 패턴 데이터입니다. 주어진 데이터를 기반으로 깊이 있는 유사도 분석을 수행해주세요. 반드시 제공된 데이터만을 근거로 분석하고, 맥락을 벗어나지 마세요.

내 매장 ${timeType} 시간대별 판매 비율:
${timeSlots.map((slot: string, idx: number) => `- ${slot}: ${(myStoreData[idx] || 0).toFixed(2)}%`).join('\n')}

${comparisonLabel} ${timeType} 시간대별 판매 비율:
${timeSlots.map((slot: string, idx: number) => `- ${slot}: ${(comparisonData[idx] || 0).toFixed(2)}%`).join('\n')}

위 데이터를 기반으로 다음을 포함한 깊이 있는 분석 텍스트를 작성해주세요:
1. 시간대별 패턴 유사도 평가 (구체적인 시간대와 수치를 언급)
2. 매출이 집중되는 주요 시간대 비교
3. 차이가 있는 시간대와 그 의미 (고객 행동 패턴 관점)
4. ${timeType} 특성에 맞는 상권 특성 및 고객층 분석

중요: 반드시 제공된 수치 데이터만을 근거로 분석하고, 추측하거나 일반적인 내용을 추가하지 마세요. 각 시간대의 구체적인 수치를 언급하며 분석하세요. 핵심만 담아 정확히 2줄로만 작성해주세요.`
    } else if (analysisType === '주중주말패턴') {
      const { myWeekendRatio, comparisonWeekendRatio, isAverage } = data
      const comparisonLabel = isAverage ? '유사매장 평균' : '유사매장'
      
      const myPercentDiff = ((myWeekendRatio - 1) * 100).toFixed(1)
      const comparisonPercentDiff = ((comparisonWeekendRatio - 1) * 100).toFixed(1)
      const ratioDiff = Math.abs(myWeekendRatio - comparisonWeekendRatio).toFixed(2)
      
      prompt = `다음은 편의점 매장의 주중/주말 판매 패턴 데이터입니다. 주어진 데이터를 기반으로 깊이 있는 유사도 분석을 수행해주세요. 반드시 제공된 데이터만을 근거로 분석하고, 맥락을 벗어나지 마세요.

내 매장 주말/주중 매출 비율: ${myWeekendRatio.toFixed(2)} (주중 대비 주말이 ${parseFloat(myPercentDiff) > 0 ? `${myPercentDiff}% 높음` : `${Math.abs(parseFloat(myPercentDiff))}% 낮음`})
${comparisonLabel} 주말/주중 매출 비율: ${comparisonWeekendRatio.toFixed(2)} (주중 대비 주말이 ${parseFloat(comparisonPercentDiff) > 0 ? `${comparisonPercentDiff}% 높음` : `${Math.abs(parseFloat(comparisonPercentDiff))}% 낮음`})
비율 차이: ${ratioDiff}

위 데이터를 기반으로 다음을 포함한 깊이 있는 분석 텍스트를 작성해주세요:
1. 주중/주말 매출 패턴 유사도 평가 (구체적인 비율 수치를 언급)
2. 두 매장의 주중/주말 특성 비교 (주말 중심형 vs 주중 중심형)
3. 차이의 의미와 상권 특성에 대한 분석
4. 고객층 및 지역 특성에 대한 구체적인 인사이트

중요: 반드시 제공된 수치 데이터만을 근거로 분석하고, 추측하거나 일반적인 내용을 추가하지 마세요. 구체적인 비율 수치를 언급하며 분석하세요. 핵심만 담아 정확히 2줄로만 작성해주세요.`
    } else {
      return NextResponse.json(
        { error: '유효하지 않은 분석 타입입니다.' },
        { status: 400 }
      )
    }

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 편의점 매장 데이터 분석 전문가입니다. 제공된 데이터를 기반으로 정확하고 구체적인 분석을 수행합니다. 반드시 제공된 수치 데이터만을 근거로 하며, 추측이나 일반론을 피합니다.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: 'OpenAI API 호출 실패', details: errorData },
        { status: response.status }
      )
    }

    const result = await response.json()
    const analysisText = result.choices[0]?.message?.content || '분석을 생성할 수 없습니다.'

    return NextResponse.json({ analysis: analysisText })
  } catch (error: any) {
    console.error('분석 생성 오류:', error)
    return NextResponse.json(
      { error: '분석 생성 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    )
  }
}

