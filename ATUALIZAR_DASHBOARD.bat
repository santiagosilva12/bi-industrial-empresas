@echo off
chcp 65001 > nul
title METALÚRGICA BRILHO & MODERNA - ATUALIZAR DADOS
color 0B
cls
echo ======================================================================
echo    METALÚRGICA BRILHO & MODERNA - ATUALIZADOR AUTOMÁTICO DE DADOS
echo ======================================================================
echo.
echo  Lendo relatórios do Conta Azul (2020 a 2026), Curva ABC,
echo  vendas por Estado, Folha de Pagamento Anual (12 meses),
echo  produtividade por colaborador e split fiscal...
echo.
if exist "%~dp0Arquivos.py\atualizar_dados.py" (
    py "%~dp0Arquivos.py\atualizar_dados.py"
) else (
    py "%~dp0atualizar_dados.py"
)
echo.
if %ERRORLEVEL% EQU 0 (
    echo ======================================================================
    echo  [SUCESSO] Base de dados compilada com sucesso!
    echo  Você já pode abrir o painel clicando em ABRIR_DASHBOARD.bat
    echo ======================================================================
) else (
    echo [ERRO] Ocorreu um problema ao atualizar os dados. Verifique as mensagens acima.
)
echo.
pause
