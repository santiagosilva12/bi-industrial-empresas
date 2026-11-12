@echo off
title SERVIDOR LOCAL - METALÚRGICA BRILHO & MODERNA
cls
echo Iniciando servidor web local na porta 8080...
echo Acesse: http://localhost:8080
start "" "http://localhost:8080"
python -m http.server 8080
pause
