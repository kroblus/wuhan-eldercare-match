interface VisitEvaluationRouteData {
  visitId: string
  hasVisitId: boolean
}

Page({
  data: {
    visitId: '',
    hasVisitId: false,
  } as VisitEvaluationRouteData,

  onLoad(query: Record<string, string | undefined>) {
    const visitId = query.visitId
    if (typeof visitId !== 'string' || visitId.trim().length === 0
      || visitId.length > 200 || /[\u0000-\u001f\u007f]/.test(visitId)) {
      this.setData({ visitId: '', hasVisitId: false })
      return
    }
    this.setData({ visitId, hasVisitId: true })
  },
})
