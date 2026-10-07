Attribute VB_Name = "modOrdenacao"
Option Explicit

' Ordena automaticamente as abas SETEMBRO, OUTUBRO, NOVEMBRO e DEZEMBRO:
'   1) PAGO  2) PARCIALMENTE PAGO  3) NAO PAGO  4) linhas vazias
' Dentro de cada grupo a ordem atual das linhas e mantida.

Private Const COL_FORN As Long = 4      ' D - FORNECEDOR
Private Const COL_VALOR As Long = 6     ' F - VALOR TOTAL
Private Const COL_STATUS As Long = 13   ' M - STATUS
Private Const COL_AUX As Long = 30      ' AD - coluna temporaria (apagada ao final)

Private emOrdenacao As Boolean

Private Function LinhaCabecalho(ByVal nomeAba As String) As Long
    Select Case UCase$(nomeAba)
        Case "SETEMBRO", "OUTUBRO": LinhaCabecalho = 4
        Case "NOVEMBRO", "DEZEMBRO": LinhaCabecalho = 2
        Case Else: LinhaCabecalho = 0
    End Select
End Function

Private Function RankLinha(ByVal forn As Variant, ByVal valor As Variant, ByVal status As Variant) As Long
    Dim st As String
    If IsError(forn) Then RankLinha = 4: Exit Function
    If Len(Trim$(CStr(forn))) = 0 Then RankLinha = 4: Exit Function
    ' linha ainda sem valor total preenchido nao deve subir como "PAGO"
    If IsError(valor) Then RankLinha = 3: Exit Function
    If Not IsNumeric(valor) Then RankLinha = 3: Exit Function
    If CDbl(valor) <= 0 Then RankLinha = 3: Exit Function
    If IsError(status) Then RankLinha = 3: Exit Function
    st = UCase$(Trim$(CStr(status)))
    Select Case st
        Case "PAGO": RankLinha = 1
        Case "PARCIALMENTE PAGO": RankLinha = 2
        Case Else: RankLinha = 3
    End Select
End Function

Public Sub OrdenarPorStatus(ByVal ws As Worksheet)
    Dim cab As Long, primeira As Long, ultima As Long
    Dim i As Long, n As Long
    Dim dados As Variant, aux() As Variant
    Dim rk As Long, rkAnt As Long, precisa As Boolean
    Dim rng As Range

    cab = LinhaCabecalho(ws.Name)
    If cab = 0 Then Exit Sub
    If emOrdenacao Then Exit Sub
    If ws.ProtectContents Then Exit Sub

    primeira = cab + 1
    ultima = ws.Cells(ws.Rows.Count, COL_FORN).End(xlUp).Row
    If ultima <= primeira Then Exit Sub
    n = ultima - primeira + 1

    dados = ws.Range(ws.Cells(primeira, 1), ws.Cells(ultima, COL_STATUS)).Value
    ReDim aux(1 To n, 1 To 1)

    rkAnt = 0
    For i = 1 To n
        rk = RankLinha(dados(i, COL_FORN), dados(i, COL_VALOR), dados(i, COL_STATUS))
        If rk < rkAnt Then precisa = True
        rkAnt = rk
        aux(i, 1) = rk * 100000# + i      ' mantem a ordem original dentro do grupo
    Next i
    If Not precisa Then Exit Sub          ' ja esta ordenada

    emOrdenacao = True
    On Error GoTo Falha
    Application.EnableEvents = False
    Application.ScreenUpdating = False

    ws.Range(ws.Cells(primeira, COL_AUX), ws.Cells(ultima, COL_AUX)).Value = aux
    Set rng = ws.Range(ws.Cells(primeira, 1), ws.Cells(ultima, COL_AUX))
    rng.Sort Key1:=ws.Cells(primeira, COL_AUX), Order1:=xlAscending, Header:=xlNo, _
             Orientation:=xlTopToBottom
    ws.Range(ws.Cells(primeira, COL_AUX), ws.Cells(ultima, COL_AUX)).ClearContents

Saida:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    emOrdenacao = False
    Exit Sub
Falha:
    On Error Resume Next
    ws.Range(ws.Cells(primeira, COL_AUX), ws.Cells(ultima, COL_AUX)).ClearContents
    Resume Saida
End Sub

Public Sub OrdenarTodasAsAbas()
    Dim nome As Variant
    For Each nome In Array("SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO")
        OrdenarPorStatus ThisWorkbook.Worksheets(CStr(nome))
    Next nome
End Sub
