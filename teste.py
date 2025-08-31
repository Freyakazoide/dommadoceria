# -*- coding: utf-8 -*-

# Nome dos arquivos de entrada e saída
arquivo_entrada = 'entrada.csv'
arquivo_saida = 'saida.txt'

print(f"Iniciando o processamento do arquivo '{arquivo_entrada}'...")

# Lista para armazenar todos os códigos de produto limpos
todos_os_codigos = []

# Tenta abrir e ler o arquivo de entrada para coletar todos os códigos
try:
    with open(arquivo_entrada, 'r', encoding='utf-8') as infile:
        for linha in infile:
            # Remove espaços em branco e quebras de linha do início/fim
            linha_limpa = linha.strip()

            # Pula linhas que estiverem vazias
            if not linha_limpa:
                continue
            
            # Adiciona o código limpo à nossa lista
            todos_os_codigos.append(linha_limpa)

    # Verifica se algum código foi encontrado antes de prosseguir
    if not todos_os_codigos:
        print("⚠️ Atenção: Nenhum código foi encontrado no arquivo de entrada.")
    else:
        # Junta todos os códigos coletados em uma única string, separados por vírgula
        string_completa_de_codigos = ','.join(todos_os_codigos)
        
        # Abre o arquivo de saída para escrever as novas regras
        with open(arquivo_saida, 'w', encoding='utf-8') as outfile:
            # --- Início da nova lógica simplificada ---

            # Faixa 1 (Especial): Quantidade 3, Desconto 12,5
            outfile.write(f"{string_completa_de_codigos};3;12,5\n")

            # Faixas 2 em diante: Quantidades de 4 a 20, Desconto sempre 25
            for quantidade in range(4, 21): # range(4, 21) vai de 4 a 20
                outfile.write(f"{string_completa_de_codigos};{quantidade};25\n")

            # --- Fim da nova lógica ---

        # Calcula o total de linhas geradas (1 para qtd 3 + 17 para qtds 4-20) = 18 linhas
        total_linhas_geradas = 1 + (20 - 4 + 1)
        print(f"✅ Sucesso! O arquivo '{arquivo_saida}' foi gerado com {total_linhas_geradas} linhas de promoção.")
        print(f"Total de {len(todos_os_codigos)} códigos foram incluídos em cada linha.")

except FileNotFoundError:
    print(f"❌ ERRO: O arquivo '{arquivo_entrada}' não foi encontrado.")
    print("Verifique se ele está na mesma pasta que o script e com o nome correto.")
except Exception as e:
    print(f"❌ Ocorreu um erro inesperado: {e}")