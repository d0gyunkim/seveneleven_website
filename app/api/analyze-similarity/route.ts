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
      
      const topSimilar = [...categoryDiffs].sort((a, b) => a.diff - b.diff).slice(0, 2)
      const topDifferent = [...categoryDiffs].sort((a, b) => b.diff - a.diff).slice(0, 2)
      
      prompt = `편의점 점주님께 전달할 유사매장 판매 패턴 분석입니다.

[데이터 요약]
- 유사도: ${similarityScore.toFixed(0)}%
- 가장 유사한 카테고리: ${topSimilar.map((item: any) => `${item.category}(${item.diff.toFixed(1)}%p 차이)`).join(', ')}
- 차이가 큰 카테고리: ${topDifferent.map((item: any) => `${item.category}(${item.diff.toFixed(1)}%p 차이)`).join(', ')}

위 데이터를 바탕으로 전문적인 어조로 핵심만 정확히 2줄 이내로 작성해주세요. 수치를 직접 나열하지 말고 자연스럽게 설명하되, 반드시 제공된 데이터만을 근거로 하세요.`
    } else if (analysisType === '시간대패턴') {
      const { myStoreData, comparisonData, timeSlots, timeType, isAverage } = data
      const comparisonLabel = isAverage ? '유사매장 평균' : '유사매장'
      
      const timeDiffs = timeSlots.map((slot: string, idx: number) => ({
        slot,
        diff: Math.abs((myStoreData[idx] || 0) - (comparisonData[idx] || 0)),
        myValue: myStoreData[idx] || 0,
        similarValue: comparisonData[idx] || 0
      }))
      const mostSimilarTime = [...timeDiffs].sort((a, b) => a.diff - b.diff).slice(0, 1)[0]
      const peakTime = timeDiffs.reduce((max: {slot: string, diff: number, myValue: number, similarValue: number}, item: {slot: string, diff: number, myValue: number, similarValue: number}) => (item.myValue + item.similarValue) > (max.myValue + max.similarValue) ? item : max, timeDiffs[0])
      
      prompt = `편의점 점주님께 전달할 ${timeType} 시간대별 판매 패턴 분석입니다.

[데이터 요약]
- 가장 유사한 시간대: ${mostSimilarTime.slot} (차이 ${mostSimilarTime.diff.toFixed(1)}%p)
- 매출 집중 시간대: ${peakTime.slot} (내 매장 ${peakTime.myValue.toFixed(1)}%, ${comparisonLabel} ${peakTime.similarValue.toFixed(1)}%)

위 데이터를 바탕으로 전문적인 어조로 핵심만 정확히 2줄 이내로 작성해주세요. 수치를 직접 나열하지 말고 자연스럽게 설명하되, 반드시 제공된 데이터만을 근거로 하세요.`
    } else if (analysisType === '주중주말패턴') {
      const { myWeekendRatio, comparisonWeekendRatio, isAverage } = data
      const comparisonLabel = isAverage ? '유사매장 평균' : '유사매장'
      
      const myPercentDiff = ((myWeekendRatio - 1) * 100).toFixed(1)
      const comparisonPercentDiff = ((comparisonWeekendRatio - 1) * 100).toFixed(1)
      const ratioDiff = Math.abs(myWeekendRatio - comparisonWeekendRatio).toFixed(2)
      
      const myType = myWeekendRatio > 1.1 ? '주말 중심형' : myWeekendRatio < 0.9 ? '주중 중심형' : '균형형'
      const similarType = comparisonWeekendRatio > 1.1 ? '주말 중심형' : comparisonWeekendRatio < 0.9 ? '주중 중심형' : '균형형'
      
      prompt = `편의점 점주님께 전달할 주중/주말 판매 패턴 분석입니다.

[데이터 요약]
- 내 매장: 주말/주중 비율 ${myWeekendRatio.toFixed(2)} (${myType})
- ${comparisonLabel}: 주말/주중 비율 ${comparisonWeekendRatio.toFixed(2)} (${similarType})
- 비율 차이: ${ratioDiff}

위 데이터를 바탕으로 전문적인 어조로 핵심만 정확히 2줄 이내로 작성해주세요. 수치를 직접 나열하지 말고 자연스럽게 설명하되, 반드시 제공된 데이터만을 근거로 하세요.`
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
            content: '당신은 편의점 매장 데이터 분석 전문가입니다. 제공된 데이터만을 근거로 전문적인 어조로 핵심만 간단히 설명합니다. 수치를 직접 나열하지 않고 자연스럽게 설명하며, 인사이트나 추측은 포함하지 않습니다.'
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

