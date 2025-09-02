// Este arquivo (estoque.js) será responsável por calcular e exibir o estoque.

async function calcularEExibirEstoque() {
    const corpoTabela = document.getElementById('corpo-tabela-estoque');
    if (!corpoTabela) return;

    corpoTabela.innerHTML = '<tr><td colspan="3">Calculando estoque...</td></tr>';

    try {
        // 1. Buscar todos os dados necessários em paralelo
        const [
            { data: insumos, error: insumosError },
            { data: todasAsCompras, error: comprasError },
            { data: todasAsVendas, error: vendasError },
            { data: todasAsReceitas, error: receitasError }
        ] = await Promise.all([
            supabaseClient.from('insumos').select('id, nome, unidade_medida'),
            supabaseClient.from('nota_entrada_itens').select('insumo_id, quantidade'),
            supabaseClient.from('nota_fiscal_itens').select('produto_id, quantidade'),
            supabaseClient.from('receitas').select('produto_id, insumo_id, quantidade')
        ]);

        if (insumosError || comprasError || vendasError || receitasError) {
            throw new Error('Falha ao buscar dados para o estoque.');
        }

        // 2. Processar os dados para cálculo
        const estoque = {};

        // Inicializa o estoque para cada insumo
        insumos.forEach(insumo => {
            estoque[insumo.id] = {
                nome: insumo.nome,
                unidade_medida: insumo.unidade_medida,
                totalComprado: 0,
                totalUsado: 0,
                estoqueAtual: 0
            };
        });

        // Soma todas as compras
        todasAsCompras.forEach(item => {
            if (estoque[item.insumo_id]) {
                estoque[item.insumo_id].totalComprado += Number(item.quantidade);
            }
        });

        // Calcula o total de insumos usados nas vendas
        todasAsVendas.forEach(itemVendido => {
            const receitasDoProduto = todasAsReceitas.filter(r => r.produto_id === itemVendido.produto_id);
            receitasDoProduto.forEach(receita => {
                if (estoque[receita.insumo_id]) {
                    const quantidadeUsada = Number(receita.quantidade) * Number(itemVendido.quantidade);
                    estoque[receita.insumo_id].totalUsado += quantidadeUsada;
                }
            });
        });

        // Calcula o estoque final e prepara para renderizar
        const estoqueFinal = Object.values(estoque).map(insumo => {
            insumo.estoqueAtual = insumo.totalComprado - insumo.totalUsado;
            return insumo;
        });

        renderizarTabelaEstoque(estoqueFinal);

    } catch (error) {
        console.error("Erro ao calcular estoque:", error);
        showNotification("Erro ao calcular o estoque.", "error");
        corpoTabela.innerHTML = '<tr><td colspan="3">Erro ao carregar o estoque.</td></tr>';
    }
}

function renderizarTabelaEstoque(estoque) {
    const corpoTabela = document.getElementById('corpo-tabela-estoque');
    const filtro = document.getElementById('filtro-busca-estoque').value.toLowerCase();
    corpoTabela.innerHTML = '';

    const dadosFiltrados = estoque.filter(item => item.nome.toLowerCase().includes(filtro));

    if (dadosFiltrados.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="3">Nenhum insumo encontrado.</td></tr>';
        return;
    }

    dadosFiltrados.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.unidade_medida}</td>
            <td>${item.estoqueAtual.toFixed(2)}</td>
        `;
        corpoTabela.appendChild(tr);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const filtroEstoque = document.getElementById('filtro-busca-estoque');
    if (filtroEstoque) {
        filtroEstoque.addEventListener('input', calcularEExibirEstoque);
    }

    const linkEstoque = document.querySelector('.nav-link[data-target="tela-estoque"]');
    if (linkEstoque) {
        linkEstoque.addEventListener('click', calcularEExibirEstoque);
    }
    
    document.addEventListener('dadosAtualizados', calcularEExibirEstoque);
});