// ---===[ CONFIGURAÇÃO DO SUPABASE ]===---
const SUPABASE_URL = 'https://bujffxasexuglgmtloxv.supabase.co';
// Lembre-se de substituir pela sua chave ANÔNIMA PÚBLICA, não a senha do banco!
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1amZmeGFzZXh1Z2xnbXRsb3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTY1NDAsImV4cCI6MjA3MTEzMjU0MH0.OmbttnQ6ThFCYuspr3IL2b25RULx_ZqoXUfcoN7KF_M'; 

// Cria o "cliente" Supabase. Usamos o objeto global 'supabase' e guardamos em 'supabaseClient'
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Espera todo o conteúdo da página carregar antes de rodar o script
document.addEventListener('DOMContentLoaded', () => {

    // Pega todos os botões da navegação
    const navButtons = document.querySelectorAll('nav button');

    // Pega todas as seções (telas) do conteúdo principal
    const telas = document.querySelectorAll('main .tela');

    // Função para mostrar uma tela específica e esconder as outras
    function mostrarTela(targetId) {
        // Esconde todas as telas
        telas.forEach(tela => {
            tela.classList.add('hidden');
        });

        // Mostra apenas a tela alvo
        const telaAlvo = document.getElementById(targetId);
        if (telaAlvo) {
            telaAlvo.classList.remove('hidden');
        }
    }

    // Adiciona um evento de clique para cada botão da navegação
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Pega o alvo do atributo 'data-target' do botão
            const targetId = button.getAttribute('data-target');
            mostrarTela(targetId);
        });
    });

    // Garante que a primeira tela (Insumos) seja exibida ao carregar a página
    mostrarTela('tela-insumos');

    // ---===[ LÓGICA DA TELA DE INSUMOS ]===---

    const formInsumos = document.getElementById('form-insumos');
    const listaInsumos = document.getElementById('lista-insumos');

    // Função para buscar e exibir os insumos do banco de dados
    async function carregarInsumos() {
        // Usamos o nosso 'supabaseClient' para a query
        const { data: insumos, error } = await supabaseClient
            .from('insumos')
            .select('*');

        if (error) {
            console.error('Erro ao buscar insumos:', error);
            return;
        }

        listaInsumos.innerHTML = '';

        if (insumos.length === 0) {
            listaInsumos.innerHTML = '<li>Nenhum insumo cadastrado ainda.</li>';
            return;
        }

        insumos.forEach(insumo => {
            const item = document.createElement('li');
            // Usamos .toFixed(2) para garantir duas casas decimais no preço
            const precoFormatado = Number(insumo.preco_unitario).toFixed(2);
            item.textContent = `${insumo.nome} (${insumo.unidade_medida}) - R$ ${precoFormatado}`;
            listaInsumos.appendChild(item);
        });
    }

    // Evento que é disparado quando o formulário de insumos é enviado
    formInsumos.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nome = document.getElementById('nome-insumo').value;
        const unidade = document.getElementById('unidade-medida').value;
        const preco = document.getElementById('preco-unitario').value;

        // Usamos o nosso 'supabaseClient' para a inserção
        const { data, error } = await supabaseClient
            .from('insumos')
            .insert([
                { nome: nome, unidade_medida: unidade, preco_unitario: preco }
            ]);
        
        if (error) {
            console.error('Erro ao salvar insumo:', error);
            alert('Ocorreu um erro ao salvar. Tente novamente.');
        } else {
            alert('Insumo salvo com sucesso!');
            formInsumos.reset();
            carregarInsumos();
        }
    });

    // Chama a função para carregar os insumos assim que a página carrega
    carregarInsumos();

    // ---===[ LÓGICA DA TELA DE RECEITAS ]===---

    const formProdutos = document.getElementById('form-produtos');
    const selectProduto = document.getElementById('select-produto');
    const formReceitaItem = document.getElementById('form-receita-item');
    const selectInsumo = document.getElementById('select-insumo');
    const listaReceitaItems = document.getElementById('lista-receita-items');

    // Função para carregar os PRODUTOS no menu dropdown
    async function carregarProdutos() {
        const { data: produtos, error } = await supabaseClient
            .from('produtos')
            .select('id, nome');

        if (error) {
            console.error('Erro ao buscar produtos:', error);
            return;
        }

        selectProduto.innerHTML = '<option value="">Selecione um produto...</option>';
        produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto.id;
            option.textContent = produto.nome;
            selectProduto.appendChild(option);
        });
    }

    // Função para carregar os INSUMOS no segundo menu dropdown
    async function carregarInsumosParaReceita() {
        const { data: insumos, error } = await supabaseClient
            .from('insumos')
            .select('id, nome, unidade_medida');

                console.log('Resultado da busca por insumos:', insumos);


        if (error) {
            console.error('Erro ao buscar insumos para receita:', error);
            return;
        }
        
        selectInsumo.innerHTML = '<option value="">Selecione o insumo...</option>';
        insumos.forEach(insumo => {
            const option = document.createElement('option');
            option.value = insumo.id;
            option.textContent = `${insumo.nome} (${insumo.unidade_medida})`;
            selectInsumo.appendChild(option);
        });
    }
    
    // Função para carregar os ITENS DA RECEITA de um produto específico
    async function carregarItensDaReceita(produtoId) {
        if (!produtoId) {
            listaReceitaItems.innerHTML = '<li>Selecione um produto para ver sua receita.</li>';
            return;
        }

        // Esta é uma query mais complexa. Ela busca na tabela 'receitas'
        // e, para cada item, busca o nome e a unidade do 'insumo' relacionado.
        const { data, error } = await supabaseClient
            .from('receitas')
            .select(`
                quantidade,
                insumos ( nome, unidade_medida )
            `)
            .eq('produto_id', produtoId); // Onde o 'produto_id' é o que selecionamos
        
        if (error) {
            console.error('Erro ao buscar itens da receita:', error);
            return;
        }

        listaReceitaItems.innerHTML = '';
        if (data.length === 0) {
            listaReceitaItems.innerHTML = '<li>Nenhum ingrediente adicionado a esta receita.</li>';
            return;
        }
        
        data.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.quantidade} ${item.insumos.unidade_medida} de ${item.insumos.nome}`;
            listaReceitaItems.appendChild(li);
        });
    }

    // Evento: Salvar um novo PRODUTO
    formProdutos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nomeProduto = document.getElementById('nome-produto').value;

        const { error } = await supabaseClient
            .from('produtos')
            .insert([{ nome: nomeProduto }]);

        if (error) {
            alert('Erro ao salvar produto.');
            console.error(error);
        } else {
            alert('Produto salvo com sucesso!');
            formProdutos.reset();
            carregarProdutos(); // Atualiza a lista de produtos
        }
    });

    // Evento: Quando um produto é SELECIONADO no dropdown
    selectProduto.addEventListener('change', () => {
        const produtoIdSelecionado = selectProduto.value;
        if (produtoIdSelecionado) {
            formReceitaItem.classList.remove('hidden'); // Mostra o form de adicionar item
            carregarItensDaReceita(produtoIdSelecionado);
        } else {
            formReceitaItem.classList.add('hidden'); // Esconde o form
            listaReceitaItems.innerHTML = '<li>Selecione um produto para ver sua receita.</li>';
        }
    });

    // Evento: Adicionar um INSUMO à receita
    formReceitaItem.addEventListener('submit', async (event) => {
        event.preventDefault();

        const produtoId = selectProduto.value;
        const insumoId = selectInsumo.value;
        const quantidade = document.getElementById('quantidade-insumo').value;

        if (!produtoId || !insumoId || !quantidade) {
            alert('Por favor, selecione o produto, o insumo e a quantidade.');
            return;
        }

        const { error } = await supabaseClient
            .from('receitas')
            .insert([{
                produto_id: produtoId,
                insumo_id: insumoId,
                quantidade: quantidade
            }]);
        
        if (error) {
            alert('Erro ao adicionar ingrediente.');
            console.error(error);
        } else {
            alert('Ingrediente adicionado com sucesso!');
            formReceitaItem.reset();
            carregarItensDaReceita(produtoId); // Atualiza a lista de ingredientes
        }
    });

    // Chama as funções de carregamento quando a página inicia
    carregarProdutos();
    carregarInsumosParaReceita();

// ---===[ LÓGICA DA TELA DE CÁLCULO DE PREÇO ]===---

    const selectProdutoCalculo = document.getElementById('select-produto-calculo');
    const btnCalcularPreco = document.getElementById('btn-calcular-preco');
    const divResultadoCalculo = document.getElementById('resultado-calculo');

    // Função para carregar os produtos no select da tela de cálculo
    async function carregarProdutosParaCalculo() {
        // Reutilizamos a mesma busca da tela de receitas
        const { data: produtos, error } = await supabaseClient
            .from('produtos')
            .select('id, nome');

        if (error) {
            console.error('Erro ao buscar produtos para cálculo:', error);
            return;
        }

        selectProdutoCalculo.innerHTML = '<option value="">Selecione...</option>';
        produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto.id;
            option.textContent = produto.nome;
            selectProdutoCalculo.appendChild(option);
        });
    }

    // A GRANDE FUNÇÃO: Calcula o preço de custo e sugere o preço de venda
    btnCalcularPreco.addEventListener('click', async () => {
        const produtoId = selectProdutoCalculo.value;
        if (!produtoId) {
            alert('Por favor, selecione um produto primeiro.');
            return;
        }

        // 1. Buscar a receita (itens e preços dos insumos)
        const { data: itensReceita, error } = await supabaseClient
            .from('receitas')
            .select(`
                quantidade,
                insumos ( nome, preco_unitario )
            `)
            .eq('produto_id', produtoId);
        
        if (error) {
            alert('Erro ao buscar a receita.');
            console.error(error);
            return;
        }

        if (itensReceita.length === 0) {
            divResultadoCalculo.innerHTML = '<p>Este produto ainda não tem uma receita cadastrada.</p>';
            return;
        }

        // 2. Calcular o custo total dos ingredientes
        let custoTotalIngredientes = 0;
        let detalhamentoHTML = '<h4>Custo por Ingrediente:</h4><ul>';

        itensReceita.forEach(item => {
            const custoItem = item.quantidade * item.insumos.preco_unitario;
            custoTotalIngredientes += custoItem;
            detalhamentoHTML += `<li>${item.insumos.nome}: ${item.quantidade.toFixed(2)} x R$ ${item.insumos.preco_unitario.toFixed(2)} = <strong>R$ ${custoItem.toFixed(2)}</strong></li>`;
        });

        detalhamentoHTML += `</ul><p><strong>Custo Total de Ingredientes: R$ ${custoTotalIngredientes.toFixed(2)}</strong></p>`;

        // 3. Adicionar campos para outros custos e margem de lucro
        detalhamentoHTML += `
            <hr>
            <h4>Custos Adicionais e Lucro:</h4>
            <label>Outros custos (gás, embalagem, etc.): R$</label>
            <input type="number" id="outros-custos" value="0" step="0.01" style="width: 80px;">
            <br>
            <label>Margem de Lucro desejada (%):</label>
            <input type="number" id="margem-lucro" value="100" step="1" style="width: 80px;">
            <button id="btn-recalcular-venda" style="margin-top: 10px;">Calcular Preço Final</button>
            <div id="preco-final-div" style="margin-top: 20px; font-size: 1.5em; font-weight: bold;"></div>
        `;

        divResultadoCalculo.innerHTML = detalhamentoHTML;

        // 4. Adicionar evento ao novo botão de recalcular
        const btnRecalcularVenda = document.getElementById('btn-recalcular-venda');
        btnRecalcularVenda.addEventListener('click', () => {
            const outrosCustos = parseFloat(document.getElementById('outros-custos').value) || 0;
            const margemLucro = parseFloat(document.getElementById('margem-lucro').value) || 0;

            const custoTotalProducao = custoTotalIngredientes + outrosCustos;
            const lucro = custoTotalProducao * (margemLucro / 100);
            const precoFinalSugerido = custoTotalProducao + lucro;

            const precoFinalDiv = document.getElementById('preco-final-div');
            precoFinalDiv.innerHTML = `
                <p>Custo Total de Produção: R$ ${custoTotalProducao.toFixed(2)}</p>
                <p style="color: green;">Preço de Venda Sugerido: R$ ${precoFinalSugerido.toFixed(2)}</p>
            `;
        });
    });

    // Chama a função para carregar os produtos na tela de cálculo também
    carregarProdutosParaCalculo();

// ---===[ LÓGICA DA TELA DE VENDAS ]===---

    const formVendas = document.getElementById('form-vendas');
    const selectProdutoVenda = document.getElementById('select-produto-venda');
    const listaVendas = document.getElementById('lista-vendas');

    // Função para carregar os produtos no select da tela de vendas
    async function carregarProdutosParaVenda() {
        const { data: produtos, error } = await supabaseClient
            .from('produtos')
            .select('id, nome');

        if (error) {
            console.error('Erro ao buscar produtos para venda:', error);
            return;
        }

        selectProdutoVenda.innerHTML = '<option value="">Selecione o produto...</option>';
        produtos.forEach(produto => {
            const option = document.createElement('option');
            option.value = produto.id;
            option.textContent = produto.nome;
            selectProdutoVenda.appendChild(option);
        });
    }
    
    // Função para buscar e exibir as últimas vendas
    async function carregarVendas() {
        // Busca as vendas e os nomes dos produtos relacionados
        const { data: vendas, error } = await supabaseClient
            .from('vendas')
            .select(`
                *,
                produtos ( nome )
            `)
            .order('created_at', { ascending: false }) // Ordena pelas mais recentes
            .limit(10); // Limita para as últimas 10

        if (error) {
            console.error('Erro ao buscar vendas:', error);
            return;
        }

        listaVendas.innerHTML = '';
        if (vendas.length === 0) {
            listaVendas.innerHTML = '<li>Nenhuma venda registrada.</li>';
            return;
        }

        vendas.forEach(venda => {
            const item = document.createElement('li');
            const dataVenda = new Date(venda.created_at).toLocaleDateString('pt-BR');
            const nomeProduto = venda.produtos ? venda.produtos.nome : 'Produto desconhecido';
            item.textContent = `[${dataVenda}] - ${venda.quantidade_vendida}x ${nomeProduto} - Total: R$ ${venda.valor_total.toFixed(2)}`;
            listaVendas.appendChild(item);
        });
    }

    // Evento: Registrar uma nova VENDA
    formVendas.addEventListener('submit', async (event) => {
        event.preventDefault();

        const produtoId = selectProdutoVenda.value;
        const quantidade = document.getElementById('quantidade-vendida').value;
        const valorTotal = document.getElementById('valor-total-venda').value;

        const { error } = await supabaseClient
            .from('vendas')
            .insert([{
                produto_id: produtoId,
                quantidade_vendida: quantidade,
                valor_total: valorTotal
            }]);
        
        if (error) {
            alert('Erro ao registrar venda.');
            console.error(error);
        } else {
            alert('Venda registrada com sucesso!');
            formVendas.reset();
            carregarVendas(); // Atualiza a lista de vendas
        }
    });

    // Chama as funções de carregamento para esta tela
    carregarProdutosParaVenda();
    carregarVendas();


});