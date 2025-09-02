// Este arquivo (estoque.js) será responsável por calcular e exibir o estoque.

// Estado da tabela de estoque
let sortColumnEstoque = 'nome';
let sortDirectionEstoque = 'asc';

async function calcularEExibirEstoque() {
    const corpoTabela = document.getElementById('corpo-tabela-estoque');
    if (!corpoTabela) return;

    corpoTabela.innerHTML = '<tr><td colspan="5">Calculando estoque...</td></tr>';

    try {
        const [
            { data: insumos, error: insumosError },
            { data: todasAsCompras, error: comprasError },
            { data: todasAsVendas, error: vendasError },
            { data: todasAsReceitas, error: receitasError }
        ] = await Promise.all([
            supabaseClient.from('insumos').select('id, nome, unidade_medida, nivel_minimo_estoque'),
            supabaseClient.from('nota_entrada_itens').select('insumo_id, quantidade'),
            supabaseClient.from('nota_fiscal_itens').select('produto_id, quantidade'),
            supabaseClient.from('receitas').select('produto_id, insumo_id, quantidade')
        ]);

        if (insumosError || comprasError || vendasError || receitasError) {
            throw new Error('Falha ao buscar dados para o estoque.');
        }

        const estoque = {};

        insumos.forEach(insumo => {
            estoque[insumo.id] = {
                nome: insumo.nome,
                unidade_medida: insumo.unidade_medida,
                nivel_minimo_estoque: Number(insumo.nivel_minimo_estoque) || 0,
                totalComprado: 0,
                totalUsado: 0,
                estoqueAtual: 0
            };
        });

        todasAsCompras.forEach(item => {
            if (estoque[item.insumo_id]) {
                estoque[item.insumo_id].totalComprado += Number(item.quantidade);
            }
        });

        todasAsVendas.forEach(itemVendido => {
            const receitasDoProduto = todasAsReceitas.filter(r => r.produto_id === itemVendido.produto_id);
            receitasDoProduto.forEach(receita => {
                if (estoque[receita.insumo_id]) {
                    const quantidadeUsada = Number(receita.quantidade) * Number(itemVendido.quantidade);
                    estoque[receita.insumo_id].totalUsado += quantidadeUsada;
                }
            });
        });

        const estoqueFinal = Object.values(estoque).map(insumo => {
            insumo.estoqueAtual = insumo.totalComprado - insumo.totalUsado;
            return insumo;
        });

        renderizarTabelaEstoque(estoqueFinal);

    } catch (error) {
        console.error("Erro ao calcular estoque:", error);
        showNotification("Erro ao calcular o estoque.", "error");
        corpoTabela.innerHTML = '<tr><td colspan="5">Erro ao carregar o estoque.</td></tr>';
    }
}

function renderizarTabelaEstoque(estoque) {
    const corpoTabela = document.getElementById('corpo-tabela-estoque');
    const filtro = document.getElementById('filtro-busca-estoque').value.toLowerCase();
    corpoTabela.innerHTML = '';

    let dadosFiltrados = estoque.filter(item => item.nome.toLowerCase().includes(filtro));

    dadosFiltrados.sort((a, b) => {
        const valA = (typeof a[sortColumnEstoque] === 'string') ? a[sortColumnEstoque].toLowerCase() : a[sortColumnEstoque];
        const valB = (typeof b[sortColumnEstoque] === 'string') ? b[sortColumnEstoque].toLowerCase() : b[sortColumnEstoque];

        if (valA < valB) return sortDirectionEstoque === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirectionEstoque === 'asc' ? 1 : -1;
        return 0;
    });
    
    if (dadosFiltrados.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="5">Nenhum insumo encontrado.</td></tr>';
        return;
    }

    dadosFiltrados.forEach(item => {
        const tr = document.createElement('tr');
        
        let statusClass = 'status-ok';
        let statusText = 'OK';
        
        if (item.estoqueAtual <= 0) {
            statusClass = 'status-zerado';
            statusText = 'Zerado'; // Corrigido de "Zerad"
        } else if (item.estoqueAtual <= item.nivel_minimo_estoque) {
            statusClass = 'status-baixo';
            statusText = 'Baixo';
        }

        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.unidade_medida}</td>
            <td>${item.estoqueAtual.toFixed(2)}</td>
            <td>${item.nivel_minimo_estoque.toFixed(2)}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
        `;
        corpoTabela.appendChild(tr);
    });
    
    atualizarCabecalhoOrdenacaoEstoque();
}

function atualizarCabecalhoOrdenacaoEstoque() {
    document.querySelectorAll('#tela-estoque th.sortable').forEach(th => {
        const span = th.querySelector('span');
        if (!span) return;
        span.textContent = '';
        if (th.dataset.sortEstoque === sortColumnEstoque) {
            span.textContent = sortDirectionEstoque === 'asc' ? '▲' : '▼';
        }
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

    document.querySelectorAll('#tela-estoque th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const newSortColumn = th.dataset.sortEstoque;
            if (sortColumnEstoque === newSortColumn) {
                sortDirectionEstoque = sortDirectionEstoque === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumnEstoque = newSortColumn;
                sortDirectionEstoque = 'asc';
            }
            calcularEExibirEstoque();
        });
    });
});